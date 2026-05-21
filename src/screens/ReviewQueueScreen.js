import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { Avatar, BackButton } from '../components/Common';
import { ChevronDown, ChevronRight, XIcon, ArchiveIcon } from '../components/Icons';
import { fmtDate, isoToday } from '../utils/helpers';
import {
  groupByMeeting,
  findContactsByFirstName,
  splitQueueByTriage,
} from '../utils/reviewQueue';
import {
  aiExtractMeetingNote,
  aiSuggestContactsForAttendee,
  aiSummarizeMeetingForReview,
} from '../utils/ai';

// ReviewQueueScreen
//
// Layout:
//   - Two tabs at top: "New items" | "Items to review"
//   - Archive button right under the tabs (always visible)
//   - Each meeting card starts COLLAPSED. Tap to expand.
//
// Triage flow (no manual buttons):
//   - Sync drops items into 'new'
//   - User opens Review queue, expands one or more cards
//   - When the user LEAVES the Review queue screen, every item still
//     in 'new' that the user did NOT expand stays in 'new'
//     (so it's there next time they open the queue), and every item
//     that they DID expand moves to 'later' (Items to review)
//   - Wait, the user wanted: ALL current new items move on exit.
//     We additionally track whether the user expanded each card so we
//     can render a visual "unviewed" indicator on the Items to review
//     tab (accent left border) for items they never opened.
//
// Other actions:
//   - X dismisses the item to archive (immediate)
//   - Confirm contact / Create new contact removes the item (immediate)
//
// The "Move back to New" and "Review later" buttons are gone.

export default function ReviewQueueScreen({
  reviewQueue,
  contacts,
  myCard,
  onCommit,
  onRemoveFromReviewQueue,
  onPatchReviewQueueItem,
  onCreateContactFromAttendee,
  onBack,
  showToast,
  granolaAiUnlocked,
  onShowPaywall,
  initialTab,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState(initialTab === 'later' ? 'later' : 'new');
  const [viewingArchive, setViewingArchive] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(null);
  const [busyItemId, setBusyItemId] = useState(null);
  const [aiBusyItemId, setAiBusyItemId] = useState(null);
  const [summaryBusyNoteId, setSummaryBusyNoteId] = useState(null);
  const [transcriptOpenNoteIds, setTranscriptOpenNoteIds] = useState(() => new Set());
  // Per-card expand state. Defaults to collapsed for all; key is noteId.
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set());

  useEffect(() => {
    if (initialTab === 'later' || initialTab === 'new') {
      setTab(initialTab);
    }
  }, [initialTab]);

  // ---------- Track expanded noteIds for the lifetime of this screen ----------
  //
  // The set of noteIds the user has ever expanded during this visit.
  // Used to:
  //   - Stamp viewedAt onto items when the user COLLAPSES a card
  //     (in toggleExpanded), so the styling can immediately reflect
  //     "reviewed" and the item sorts to the bottom.
  //   - Auto-move expanded items from 'new' to 'later' on screen exit.
  const expandedThisSessionRef = useRef(new Set());
  // Keep latest reviewQueue + patcher in refs so the unmount cleanup
  // works against current data (not the stale closure at mount time).
  const reviewQueueRef = useRef(reviewQueue);
  const onPatchRef = useRef(onPatchReviewQueueItem);
  useEffect(() => {
    reviewQueueRef.current = reviewQueue;
  }, [reviewQueue]);
  useEffect(() => {
    onPatchRef.current = onPatchReviewQueueItem;
  }, [onPatchReviewQueueItem]);

  // On unmount: batch-move any 'new' items the user expanded this session
  // over to 'later'. Untouched items stay in 'new'.
  useEffect(() => {
    return () => {
      const queue = reviewQueueRef.current || [];
      const patch = onPatchRef.current;
      if (typeof patch !== 'function') return;
      const expanded = expandedThisSessionRef.current;
      for (const item of queue) {
        const inNew = (item.triageState || 'new') === 'new';
        const isInExpanded = item.noteId && expanded.has(item.noteId);
        if (!inNew || !isInExpanded) continue;
        try {
          patch(item.id, { triageState: 'later' });
        } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter out user-self items as a defense.
  const visibleQueue = useMemo(() => {
    if (!Array.isArray(reviewQueue)) return [];
    const myEmails = new Set();
    if (myCard?.email) myEmails.add(myCard.email.toLowerCase());
    if (Array.isArray(myCard?.emails)) {
      for (const e of myCard.emails) {
        if (e?.value) myEmails.add(e.value.toLowerCase());
      }
    }
    const myNames = new Set();
    if (myCard?.name) myNames.add(myCard.name.trim().toLowerCase());
    if (myCard?.displayName) myNames.add(myCard.displayName.trim().toLowerCase());

    return reviewQueue.filter((item) => {
      const att = item?.attendee || {};
      const email = (att.email || '').toLowerCase().trim();
      const name = (att.name || '').toLowerCase().trim();
      if (!email && !name) return true;
      if (email && myEmails.has(email)) return false;
      if (name && myNames.has(name)) return false;
      return true;
    });
  }, [reviewQueue, myCard]);

  const { newItems, laterItems, archivedItems } = useMemo(
    () => splitQueueByTriage(visibleQueue),
    [visibleQueue],
  );

  const activeList = viewingArchive
    ? archivedItems
    : tab === 'later'
      ? laterItems
      : newItems;
  const grouped = useMemo(() => groupByMeeting(activeList), [activeList]);

  function toggleExpanded(noteId) {
    const wasExpanded = expandedNoteIds.has(noteId);
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
    // Track that this card was expanded at some point this session
    expandedThisSessionRef.current.add(noteId);
    // When the user OPENS a card, immediately mark its items as viewed.
    // This drops the bold/accent styling and the NEW pill the moment
    // the dropdown opens. The item also re-sorts to the bottom of the
    // list (after collapse, since while expanded it stays in place).
    if (!wasExpanded) {
      const queue = reviewQueueRef.current || [];
      const patch = onPatchRef.current;
      if (typeof patch === 'function') {
        const nowStamp = new Date().toISOString();
        for (const item of queue) {
          if (item.noteId !== noteId) continue;
          if (item.viewedAt) continue;
          try {
            patch(item.id, { viewedAt: nowStamp });
          } catch (_) {}
        }
      }
    }
  }

  // ---------- Action: confirm a contact for a named attendee ----------
  async function applyContactToItem(item, contact) {
    if (!item || !contact || !onCommit) return;
    setBusyItemId(item.id);
    try {
      const date = item.meetingDate || isoToday();
      const rawText = item.rawText || '';
      const transcriptText = item.rawTranscript || '';

      const fallbackText =
        (rawText || '').trim() ||
        (transcriptText || '').trim() ||
        ('Meeting: ' + (item.meetingTitle || 'Untitled') + ' on ' + fmtDate(date));

      let extracted = '';
      if (granolaAiUnlocked) {
        try {
          extracted = await aiExtractMeetingNote(contact, rawText, myCard);
          if (!extracted?.trim()) extracted = fallbackText;
        } catch (e) {
          console.warn('aiExtractMeetingNote failed:', e?.message);
          extracted = fallbackText;
        }
      } else {
        extracted = fallbackText;
      }

      const entry = {
        id: 'granola_' + item.noteId + '_' + contact.id,
        date,
        text: extracted,
        type: 'meeting',
        source: 'granola',
        source_id: item.noteId,
      };
      if (transcriptText && transcriptText.trim()) {
        entry.rawTranscript = transcriptText;
      }

      const updatedContacts = contacts.map((c) => {
        if (c.id !== contact.id) return c;
        const log = Array.isArray(c.convLog) ? c.convLog : [];
        if (log.some((e) => e.id === entry.id)) return c;
        return {
          ...c,
          convLog: [entry, ...log],
          lastContacted: date > (c.lastContacted || '') ? date : c.lastContacted,
        };
      });
      onCommit(updatedContacts);

      await onRemoveFromReviewQueue(item.id);
      showToast && showToast('Added to ' + contact.name, theme.ac);
    } catch (e) {
      console.error('applyContactToItem error:', e);
      showToast && showToast('Failed to save', theme.red);
    }
    setBusyItemId(null);
    setPickerOpen(null);
  }

  async function archiveItem(item) {
    if (!item || !onPatchReviewQueueItem) return;
    setBusyItemId(item.id);
    try {
      await onPatchReviewQueueItem(item.id, {
        triageState: 'archived',
        archivedAt: new Date().toISOString(),
      });
      showToast && showToast('Archived');
    } catch (e) {
      console.warn('archiveItem failed:', e?.message);
    }
    setBusyItemId(null);
  }

  async function deleteForever(item) {
    if (!item) return;
    setBusyItemId(item.id);
    try {
      await onRemoveFromReviewQueue(item.id);
      showToast && showToast('Deleted permanently', theme.red);
    } catch (_) {}
    setBusyItemId(null);
  }

  async function restoreFromArchive(item) {
    if (!item || !onPatchReviewQueueItem) return;
    setBusyItemId(item.id);
    try {
      await onPatchReviewQueueItem(item.id, {
        triageState: 'new',
        archivedAt: null,
      });
      showToast && showToast('Restored to New items');
    } catch (e) {
      console.warn('restoreFromArchive failed:', e?.message);
    }
    setBusyItemId(null);
  }

  async function skipAiSpeaker(item, speakerIndex) {
    if (!item || !Array.isArray(item.aiAttendees)) return;
    if (!onPatchReviewQueueItem) return;
    const next = item.aiAttendees.filter((_, i) => i !== speakerIndex);
    await onPatchReviewQueueItem(item.id, { aiAttendees: next });
    if (next.length === 0) {
      await onPatchReviewQueueItem(item.id, {
        triageState: 'archived',
        archivedAt: new Date().toISOString(),
      });
      showToast && showToast('No speakers left, item archived');
    }
  }

  async function confirmAiSpeakerAsContact(item, speakerIndex, contact) {
    if (!item || !Array.isArray(item.aiAttendees)) return;
    if (!contact || !onCommit) return;
    setBusyItemId(item.id);
    try {
      const date = item.meetingDate || isoToday();
      const rawText = item.rawText || '';
      const transcriptText = item.rawTranscript || '';

      const fallbackText =
        (rawText || '').trim() ||
        (transcriptText || '').trim() ||
        ('Meeting: ' + (item.meetingTitle || 'Untitled') + ' on ' + fmtDate(date));

      let extracted = '';
      try {
        extracted = await aiExtractMeetingNote(contact, rawText, myCard);
        if (!extracted?.trim()) extracted = fallbackText;
      } catch (e) {
        console.warn('aiExtractMeetingNote failed:', e?.message);
        extracted = fallbackText;
      }

      const entry = {
        id: 'granola_' + item.noteId + '_' + contact.id,
        date,
        text: extracted,
        type: 'meeting',
        source: 'granola',
        source_id: item.noteId,
      };
      if (transcriptText && transcriptText.trim()) {
        entry.rawTranscript = transcriptText;
      }

      const updatedContacts = contacts.map((c) => {
        if (c.id !== contact.id) return c;
        const log = Array.isArray(c.convLog) ? c.convLog : [];
        if (log.some((e) => e.id === entry.id)) return c;
        return {
          ...c,
          convLog: [entry, ...log],
          lastContacted: date > (c.lastContacted || '') ? date : c.lastContacted,
        };
      });
      onCommit(updatedContacts);

      const nextAttendees = item.aiAttendees.filter((_, i) => i !== speakerIndex);
      if (nextAttendees.length === 0) {
        await onRemoveFromReviewQueue(item.id);
      } else {
        await onPatchReviewQueueItem(item.id, { aiAttendees: nextAttendees });
      }
      showToast && showToast('Added to ' + contact.name, theme.ac);
    } catch (e) {
      console.error('confirmAiSpeakerAsContact error:', e);
      showToast && showToast('Failed to save', theme.red);
    }
    setBusyItemId(null);
  }

  function createNewFromAiSpeaker(item, speakerIndex) {
    if (!item || !Array.isArray(item.aiAttendees)) return;
    const speaker = item.aiAttendees[speakerIndex];
    if (!speaker) return;

    const handoff = {
      ...item,
      attendee: {
        name: speaker.name || '',
        email: speaker.email || '',
      },
      suggestion: speaker.identifyingContext
        ? { contactId: null, reason: speaker.identifyingContext }
        : null,
      _aiSpeakerSource: {
        parentItemId: item.id,
        speakerIndex,
      },
    };

    if (onCreateContactFromAttendee) {
      onCreateContactFromAttendee(handoff);
    }
  }

  async function fetchAiSuggestions(item) {
    if (!item || !onPatchReviewQueueItem) return;
    if (!granolaAiUnlocked) {
      onShowPaywall && onShowPaywall('granola_ai_processing');
      return;
    }
    setAiBusyItemId(item.id);
    try {
      const snippet = (item.rawTranscript || item.rawText || '').slice(0, 1500);
      const suggestions = await aiSuggestContactsForAttendee({
        attendee: item.attendee,
        meetingTitle: item.meetingTitle,
        meetingDate: item.meetingDate,
        transcriptSnippet: snippet,
        contacts,
      });
      await onPatchReviewQueueItem(item.id, { aiSuggestions: suggestions });
      if (!suggestions || suggestions.length === 0) {
        showToast && showToast('No suggestions found', theme.warn);
      }
    } catch (e) {
      console.warn('AI suggestions failed:', e?.message);
      showToast && showToast('AI suggestions failed', theme.red);
    }
    setAiBusyItemId(null);
  }

  function handleCreateNewContact(item) {
    if (onCreateContactFromAttendee) {
      onCreateContactFromAttendee(item);
    }
  }

  async function fetchMeetingSummary(group) {
    if (!group?.noteId || !onPatchReviewQueueItem) return;
    if (summaryBusyNoteId === group.noteId) return;
    if (!granolaAiUnlocked) {
      onShowPaywall && onShowPaywall('granola_ai_processing');
      return;
    }
    const sourceItem = group.items.find((it) => it.rawText || it.rawTranscript);
    if (!sourceItem) return;
    const text = sourceItem.rawText || sourceItem.rawTranscript || '';
    if (!text.trim()) return;

    setSummaryBusyNoteId(group.noteId);
    try {
      const summary = await aiSummarizeMeetingForReview(text, {
        name: myCard?.name || '',
        company: myCard?.company || '',
      });
      for (const it of group.items) {
        await onPatchReviewQueueItem(it.id, { meetingSummary: summary });
      }
    } catch (e) {
      console.warn('Meeting summary failed:', e?.message);
      showToast && showToast('Summary failed', theme.red);
    }
    setSummaryBusyNoteId(null);
  }

  function toggleTranscript(noteId) {
    setTranscriptOpenNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function getContactById(id) {
    return (contacts || []).find((c) => c.id === id) || null;
  }

  let subtitle = '';
  if (viewingArchive) {
    subtitle =
      archivedItems.length === 0
        ? 'No archived items.'
        : `${archivedItems.length} archived item${archivedItems.length === 1 ? '' : 's'}.`;
  } else if (activeList.length === 0) {
    subtitle =
      tab === 'later'
        ? "Items you've reviewed before will show here."
        : "You're all caught up.";
  } else {
    subtitle = `${activeList.length} ${activeList.length === 1 ? 'meeting' : 'meetings'} to review.`;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 100,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <BackButton
            onPress={() => {
              if (viewingArchive) setViewingArchive(false);
              else onBack && onBack();
            }}
          />
        </View>

        <Text
          style={{
            fontSize: 22,
            color: theme.t1,
            fontWeight: '600',
            marginTop: 14,
            marginBottom: 4,
            fontFamily: theme.fontDisplay,
          }}
        >
          {viewingArchive ? 'Archived items' : 'Review queue'}
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5, marginBottom: 14, lineHeight: 17 }}>
          {subtitle}
        </Text>

        {!viewingArchive && (
          <>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                borderRadius: 12,
                padding: 4,
                marginBottom: 10,
              }}
            >
              <TabButton
                label="New items"
                count={newItems.length}
                active={tab === 'new'}
                onPress={() => setTab('new')}
                theme={theme}
              />
              <TabButton
                label="Items to review"
                count={laterItems.length}
                active={tab === 'later'}
                onPress={() => setTab('later')}
                theme={theme}
              />
            </View>

            <TouchableOpacity
              onPress={() => setViewingArchive(true)}
              activeOpacity={0.7}
              style={{
                marginBottom: 16,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ArchiveIcon size={14} color={theme.t4} />
              <Text style={{ flex: 1, fontSize: 12, color: theme.t3, fontWeight: '500' }}>
                Archive
              </Text>
              {archivedItems.length > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: theme.bg3,
                    minWidth: 22,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, color: theme.t5, fontWeight: '700' }}>
                    {archivedItems.length}
                  </Text>
                </View>
              ) : null}
              <ChevronRight size={14} color={theme.t5} />
            </TouchableOpacity>
          </>
        )}

        {activeList.length === 0 ? (
          <EmptyState theme={theme} mode={viewingArchive ? 'archive' : tab} />
        ) : (
          grouped.map((group) => (
            <MeetingGroup
              key={group.noteId}
              group={group}
              contacts={contacts}
              busyItemId={busyItemId}
              aiBusyItemId={aiBusyItemId}
              summaryBusy={summaryBusyNoteId === group.noteId}
              transcriptOpen={transcriptOpenNoteIds.has(group.noteId)}
              expanded={expandedNoteIds.has(group.noteId)}
              theme={theme}
              currentTab={tab}
              viewingArchive={viewingArchive}
              getContactById={getContactById}
              granolaAiUnlocked={granolaAiUnlocked}
              onToggleExpand={() => toggleExpanded(group.noteId)}
              onConfirm={(item, contact) => applyContactToItem(item, contact)}
              onPickDifferent={(item) => setPickerOpen({ item, scope: 'all' })}
              onPickSameFirstName={(item) =>
                setPickerOpen({ item, scope: 'firstName' })
              }
              onFetchAiSuggestions={fetchAiSuggestions}
              onFetchMeetingSummary={fetchMeetingSummary}
              onToggleTranscript={toggleTranscript}
              onCreateNew={handleCreateNewContact}
              onAddToExisting={(item) =>
                setPickerOpen({ item, scope: 'all' })
              }
              onArchive={archiveItem}
              onRestore={restoreFromArchive}
              onDeleteForever={deleteForever}
              onConfirmAiSpeaker={confirmAiSpeakerAsContact}
              onSkipAiSpeaker={skipAiSpeaker}
              onCreateNewFromAiSpeaker={createNewFromAiSpeaker}
            />
          ))
        )}

        {viewingArchive && (
          <TouchableOpacity
            onPress={() => setViewingArchive(false)}
            activeOpacity={0.7}
            style={{
              marginTop: 16,
              paddingVertical: 12,
              alignItems: 'center',
              borderRadius: 10,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd,
            }}
          >
            <Text style={{ fontSize: 12, color: theme.ac, fontWeight: '600' }}>
              Back to review queue
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ContactPickerModal
        state={pickerOpen}
        onClose={() => setPickerOpen(null)}
        contacts={contacts}
        onPick={(contact) => {
          if (pickerOpen?.item) applyContactToItem(pickerOpen.item, contact);
        }}
      />
    </View>
  );
}

// ----- Tab button -----

function TabButton({ label, count, active, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: 9,
        backgroundColor: active ? theme.bgAc : 'transparent',
        borderWidth: active ? 1 : 0,
        borderColor: active ? theme.brdAc : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: active ? theme.ac : theme.t5,
        }}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View
          style={{
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 6,
            minWidth: 18,
            alignItems: 'center',
            backgroundColor: active ? theme.ac : theme.bg3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: active ? '#fff' : theme.t5,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ----- Empty state -----

function EmptyState({ theme, mode }) {
  const icon = mode === 'archive' ? '🗄' : mode === 'later' ? '🗂' : '✓';
  const title =
    mode === 'archive'
      ? 'Archive is empty'
      : mode === 'later'
        ? 'Nothing here yet'
        : 'Nothing to review';
  const subtitle =
    mode === 'archive'
      ? 'Items you archive will show here. You can restore or delete them permanently.'
      : mode === 'later'
        ? 'New items you see and leave open will move here on your next visit.'
        : "Sync your Granola meetings and any attendees that can't be matched automatically will show up here.";

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 30, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: theme.t2, fontWeight: '600', marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: theme.t5, textAlign: 'center', lineHeight: 17 }}>
        {subtitle}
      </Text>
    </View>
  );
}

// ----- One meeting card (collapsible) -----

function MeetingGroup({
  group,
  contacts,
  busyItemId,
  aiBusyItemId,
  summaryBusy,
  transcriptOpen,
  expanded,
  theme,
  currentTab,
  viewingArchive,
  getContactById,
  granolaAiUnlocked,
  onToggleExpand,
  onConfirm,
  onPickDifferent,
  onPickSameFirstName,
  onFetchAiSuggestions,
  onFetchMeetingSummary,
  onToggleTranscript,
  onCreateNew,
  onAddToExisting,
  onArchive,
  onRestore,
  onDeleteForever,
  onConfirmAiSpeaker,
  onSkipAiSpeaker,
  onCreateNewFromAiSpeaker,
}) {
  const meetingSummary =
    group.items.find((i) => i.meetingSummary)?.meetingSummary || '';
  const transcriptText =
    group.items.find((i) => i.rawTranscript)?.rawTranscript ||
    group.items.find((i) => i.rawText)?.rawText ||
    '';

  const noNameCount = group.items.filter(
    (it) => !(it.attendee?.name || '').trim() && !(it.attendee?.email || '').trim(),
  ).length;
  const namedCount = group.items.length - noNameCount;
  const headerSummaryParts = [];
  if (namedCount > 0) {
    headerSummaryParts.push(
      `${namedCount} attendee${namedCount === 1 ? '' : 's'}`,
    );
  }
  if (noNameCount > 0) {
    headerSummaryParts.push('No attendee name');
  }
  const headerSummary = headerSummaryParts.join(' / ');

  // "Unviewed" indicator: shown on both New and Items to review tabs
  // (not in archive). A card counts as unviewed when:
  //   - none of its items have a stored viewedAt yet (never opened in
  //     a past session), AND
  //   - the card is not currently expanded in this session.
  // As soon as the user expands the card, the styling drops immediately
  // for instant feedback; the viewedAt timestamp gets written on screen
  // unmount.
  const hasAnyViewed = group.items.some((it) => it.viewedAt);
  const showUnviewedIndicator =
    !viewingArchive && !hasAnyViewed && !expanded;

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: showUnviewedIndicator ? theme.ac : theme.brd,
        marginBottom: 10,
        overflow: 'hidden',
        // Accent-colored left border bar when unviewed, otherwise normal
        ...(showUnviewedIndicator
          ? { borderLeftWidth: 4, borderLeftColor: theme.ac }
          : {}),
      }}
    >
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
        }}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.ac,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {group.meetingDate ? fmtDate(group.meetingDate) : 'No date'}
            </Text>
            {showUnviewedIndicator ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: theme.bgAc,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    color: theme.ac,
                    fontWeight: '700',
                    letterSpacing: 0.4,
                  }}
                >
                  NEW
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{ fontSize: 14, color: theme.t1, fontWeight: '600' }}
            numberOfLines={2}
          >
            {group.meetingTitle}
          </Text>
          {headerSummary ? (
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 3 }}>
              {headerSummary}
            </Text>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDown size={16} color={theme.t5} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: theme.brd,
          }}
        >
          <View style={{ marginTop: 12 }}>
            <MeetingContext
              theme={theme}
              meetingSummary={meetingSummary}
              transcriptText={transcriptText}
              transcriptOpen={transcriptOpen}
              summaryBusy={summaryBusy}
              granolaAiUnlocked={granolaAiUnlocked}
              onFetchSummary={() => onFetchMeetingSummary(group)}
              onToggleTranscript={() => onToggleTranscript(group.noteId)}
            />
          </View>

          {group.items.map((item, idx) => (
            <QueueItemRow
              key={item.id}
              item={item}
              contacts={contacts}
              isLast={idx === group.items.length - 1}
              busy={busyItemId === item.id}
              aiBusy={aiBusyItemId === item.id}
              theme={theme}
              viewingArchive={viewingArchive}
              getContactById={getContactById}
              granolaAiUnlocked={granolaAiUnlocked}
              onConfirm={onConfirm}
              onPickDifferent={onPickDifferent}
              onPickSameFirstName={onPickSameFirstName}
              onFetchAiSuggestions={onFetchAiSuggestions}
              onCreateNew={onCreateNew}
              onAddToExisting={onAddToExisting}
              onArchive={onArchive}
              onRestore={onRestore}
              onDeleteForever={onDeleteForever}
              onConfirmAiSpeaker={onConfirmAiSpeaker}
              onSkipAiSpeaker={onSkipAiSpeaker}
              onCreateNewFromAiSpeaker={onCreateNewFromAiSpeaker}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MeetingContext({
  theme,
  meetingSummary,
  transcriptText,
  transcriptOpen,
  summaryBusy,
  granolaAiUnlocked,
  onFetchSummary,
  onToggleTranscript,
}) {
  const hasTranscript = !!(transcriptText && transcriptText.trim());

  return (
    <View
      style={{
        marginBottom: 10,
        padding: 10,
        borderRadius: 10,
        backgroundColor: theme.bg3,
        borderWidth: 1,
        borderColor: theme.brd,
      }}
    >
      {meetingSummary ? (
        <View style={{ marginBottom: hasTranscript ? 8 : 0 }}>
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              color: theme.purp,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            AI summary
          </Text>
          <Text style={{ fontSize: 12, color: theme.t3, lineHeight: 17 }}>
            {meetingSummary}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <TouchableOpacity
            onPress={onFetchSummary}
            disabled={summaryBusy}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: granolaAiUnlocked ? theme.purp + '60' : theme.brd2,
              backgroundColor: granolaAiUnlocked ? theme.purp + '15' : theme.bg2,
              opacity: summaryBusy ? 0.5 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {summaryBusy ? (
              <ActivityIndicator color={theme.purp} size="small" />
            ) : null}
            {!granolaAiUnlocked ? (
              <Text style={{ fontSize: 11, color: theme.t5 }}>🔒</Text>
            ) : null}
            <Text
              style={{
                color: granolaAiUnlocked ? theme.purp : theme.t5,
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {summaryBusy ? 'Summarizing...' : 'Get AI summary of meeting'}
            </Text>
            {!granolaAiUnlocked ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: theme.warn + '22',
                  marginLeft: 2,
                }}
              >
                <Text style={{ fontSize: 9, color: theme.warn, fontWeight: '700' }}>
                  PRO
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      )}

      {hasTranscript ? (
        <View style={{ marginTop: meetingSummary ? 0 : 8 }}>
          <TouchableOpacity
            onPress={onToggleTranscript}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <View
              style={{
                transform: [{ rotate: transcriptOpen ? '180deg' : '0deg' }],
              }}
            >
              <ChevronDown size={11} color={theme.t5} />
            </View>
            <Text style={{ fontSize: 11, color: theme.t5, fontWeight: '600' }}>
              {transcriptOpen ? 'Hide transcript' : 'View transcript'}
            </Text>
          </TouchableOpacity>
          {transcriptOpen ? (
            <View
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 8,
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                maxHeight: 280,
              }}
            >
              <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.t4,
                    lineHeight: 16,
                    fontFamily: theme.fontBody,
                  }}
                >
                  {transcriptText}
                </Text>
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ----- One queue item row -----

function QueueItemRow({
  item,
  contacts,
  isLast,
  busy,
  aiBusy,
  theme,
  viewingArchive,
  getContactById,
  granolaAiUnlocked,
  onConfirm,
  onPickDifferent,
  onPickSameFirstName,
  onFetchAiSuggestions,
  onCreateNew,
  onAddToExisting,
  onArchive,
  onRestore,
  onDeleteForever,
  onConfirmAiSpeaker,
  onSkipAiSpeaker,
  onCreateNewFromAiSpeaker,
}) {
  const attendeeName = (item?.attendee?.name || '').trim();
  const attendeeEmail = (item?.attendee?.email || '').trim();
  const isNoNamePlaceholder = !attendeeName && !attendeeEmail;
  const hasAiAttendees =
    Array.isArray(item.aiAttendees) && item.aiAttendees.length > 0;

  // Archive view
  if (viewingArchive) {
    return (
      <View
        style={{
          paddingTop: 10,
          paddingBottom: isLast ? 0 : 10,
          borderTopWidth: 1,
          borderTopColor: theme.brd,
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {isNoNamePlaceholder
              ? '(No attendee name from Granola)'
              : attendeeName || '(no name)'}
          </Text>
          {attendeeEmail ? (
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 1 }}>
              {attendeeEmail}
            </Text>
          ) : null}
        </View>

        {busy ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
            }}
          >
            <ActivityIndicator color={theme.ac} size="small" />
            <Text style={{ fontSize: 12, color: theme.t5 }}>Working...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <ActionBtn
              label="Restore"
              primary
              theme={theme}
              onPress={() => onRestore(item)}
            />
            <ActionBtn
              label="Delete forever"
              theme={theme}
              danger
              onPress={() => onDeleteForever(item)}
            />
          </View>
        )}
      </View>
    );
  }

  // NO-NAME PLACEHOLDER
  if (isNoNamePlaceholder) {
    return (
      <View
        style={{
          paddingTop: 10,
          paddingBottom: isLast ? 0 : 10,
          borderTopWidth: 1,
          borderTopColor: theme.brd,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: theme.warn + '22',
                borderWidth: 1,
                borderColor: theme.warn + '50',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.warn,
                  fontWeight: '700',
                  letterSpacing: 0.4,
                }}
              >
                NO ATTENDEE NAME
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.t5, flex: 1 }}>
              Granola only returned you on this meeting.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onArchive(item)}
            disabled={busy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 2 }}
          >
            <XIcon size={14} color={theme.t6} />
          </TouchableOpacity>
        </View>

        {busy ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
            }}
          >
            <ActivityIndicator color={theme.ac} size="small" />
            <Text style={{ fontSize: 12, color: theme.t5 }}>Working...</Text>
          </View>
        ) : hasAiAttendees ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: theme.purp,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              AI identified these speakers
            </Text>
            {item.aiAttendees.map((speaker, idx) => (
              <AiSpeakerRow
                key={(speaker.email || speaker.name || 'speaker') + '_' + idx}
                speaker={speaker}
                contacts={contacts}
                theme={theme}
                onAddAsNew={() => onCreateNewFromAiSpeaker(item, idx)}
                onConfirmExisting={(contact) =>
                  onConfirmAiSpeaker(item, idx, contact)
                }
                onSkip={() => onSkipAiSpeaker(item, idx)}
              />
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <ActionBtn
                label="Create new"
                primary
                theme={theme}
                onPress={() => onCreateNew(item)}
              />
              <ActionBtn
                label="Add to existing"
                theme={theme}
                onPress={() => onAddToExisting(item)}
              />
            </View>
            <Text style={{ fontSize: 10, color: theme.t6, lineHeight: 15 }}>
              View the transcript above to identify who this meeting was with.
            </Text>
          </View>
        )}
      </View>
    );
  }

  // NAMED ATTENDEE
  const suggestedContact = item.suggestion?.contactId
    ? getContactById(item.suggestion.contactId)
    : null;
  const sameFirstName = useMemo(
    () => findContactsByFirstName(item.attendee?.name, contacts),
    [item.attendee?.name, contacts],
  );

  const aiSuggestions = item.aiSuggestions;
  const hasAiResults = Array.isArray(aiSuggestions) && aiSuggestions.length > 0;
  const fetchedButEmpty = Array.isArray(aiSuggestions) && aiSuggestions.length === 0;

  return (
    <View
      style={{
        paddingTop: 10,
        paddingBottom: isLast ? 0 : 10,
        borderTopWidth: 1,
        borderTopColor: theme.brd,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {attendeeName || '(no name)'}
          </Text>
          {attendeeEmail ? (
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 1 }}>
              {attendeeEmail}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onArchive(item)}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 2 }}
        >
          <XIcon size={14} color={theme.t6} />
        </TouchableOpacity>
      </View>

      {busy ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
          }}
        >
          <ActivityIndicator color={theme.ac} size="small" />
          <Text style={{ fontSize: 12, color: theme.t5 }}>Working...</Text>
        </View>
      ) : (
        <>
          {suggestedContact ? (
            <View style={{ marginTop: 10 }}>
              <Text
                style={{
                  fontSize: 10,
                  color: theme.t5,
                  marginBottom: 6,
                  fontStyle: 'italic',
                }}
              >
                {item.suggestion?.reason || 'Suggested'}: {suggestedContact.name}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <ActionBtn
                  label={'Confirm: ' + suggestedContact.name}
                  primary
                  theme={theme}
                  onPress={() => onConfirm(item, suggestedContact)}
                />
                <ActionBtn
                  label="Different contact"
                  theme={theme}
                  onPress={() => onPickDifferent(item)}
                />
                <ActionBtn
                  label="Create new"
                  theme={theme}
                  onPress={() => onCreateNew(item)}
                />
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              {hasAiResults ? (
                <View style={{ marginBottom: 10 }}>
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: theme.purp,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    AI suggestions
                  </Text>
                  {aiSuggestions.map((sug, i) => {
                    const c = getContactById(sug.contactId);
                    if (!c) return null;
                    return (
                      <AiSuggestionCard
                        key={sug.contactId + '_' + i}
                        contact={c}
                        confidence={sug.confidence}
                        reason={sug.reason}
                        theme={theme}
                        onPress={() => onConfirm(item, c)}
                      />
                    );
                  })}
                </View>
              ) : null}

              {fetchedButEmpty ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.t5,
                    fontStyle: 'italic',
                    marginBottom: 8,
                  }}
                >
                  AI couldn't find a likely match.
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {sameFirstName.length > 0 ? (
                  <ActionBtn
                    label={
                      sameFirstName.length === 1
                        ? `1 contact named ${sameFirstName[0].name.split(/\s+/)[0]}`
                        : `${sameFirstName.length} contacts with same first name`
                    }
                    primary={!hasAiResults}
                    theme={theme}
                    onPress={() => onPickSameFirstName(item)}
                  />
                ) : null}

                {aiSuggestions === undefined ? (
                  <ActionBtn
                    label={
                      aiBusy
                        ? 'Thinking...'
                        : granolaAiUnlocked
                          ? 'Get AI suggestions'
                          : '🔒 Get AI suggestions (Pro)'
                    }
                    theme={theme}
                    purple
                    disabled={aiBusy}
                    onPress={() => !aiBusy && onFetchAiSuggestions(item)}
                  />
                ) : null}

                <ActionBtn
                  label="Search all contacts"
                  theme={theme}
                  onPress={() => onPickDifferent(item)}
                />
                <ActionBtn
                  label="Create new"
                  theme={theme}
                  onPress={() => onCreateNew(item)}
                />
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ----- AI-found speaker sub-row (legacy backward compat) -----

function AiSpeakerRow({
  speaker,
  contacts,
  theme,
  onAddAsNew,
  onConfirmExisting,
  onSkip,
}) {
  const matches = useMemo(() => {
    const out = [];
    const seen = new Set();
    const email = (speaker?.email || '').toLowerCase().trim();
    const fullName = (speaker?.name || '').trim().toLowerCase();
    const firstName = fullName.split(/\s+/)[0];

    for (const c of contacts || []) {
      if (c.archived) continue;
      const cEmail = (c.email || '').toLowerCase().trim();
      const cName = (c.name || '').toLowerCase().trim();
      const cFirst = cName.split(/\s+/)[0];

      let matchScore = 0;
      if (email && cEmail && cEmail === email) matchScore = 3;
      else if (fullName && cName && cName === fullName) matchScore = 2;
      else if (firstName && cFirst && cFirst === firstName && firstName.length >= 3)
        matchScore = 1;

      if (matchScore > 0 && !seen.has(c.id)) {
        seen.add(c.id);
        out.push({ contact: c, score: matchScore });
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 3);
  }, [speaker, contacts]);

  return (
    <View
      style={{
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.purp + '40',
        backgroundColor: theme.purp + '08',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {speaker.name || '(unnamed speaker)'}
          </Text>
          {speaker.email ? (
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 1 }}>
              {speaker.email}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onSkip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 2 }}
        >
          <XIcon size={12} color={theme.t6} />
        </TouchableOpacity>
      </View>

      {speaker.identifyingContext ? (
        <Text
          style={{
            fontSize: 11,
            color: theme.t4,
            lineHeight: 15,
            marginBottom: 8,
            fontStyle: 'italic',
          }}
        >
          {speaker.identifyingContext}
        </Text>
      ) : null}

      {matches.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 10,
              color: theme.t5,
              fontWeight: '600',
              marginBottom: 2,
            }}
          >
            Possible existing contact match:
          </Text>
          {matches.map(({ contact, score }) => (
            <TouchableOpacity
              key={contact.id}
              onPress={() => onConfirmExisting(contact)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 8,
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
              }}
            >
              <Avatar contact={contact} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: theme.t1, fontWeight: '500' }}>
                  Update {contact.name}?
                </Text>
                {(contact.role || contact.company) ? (
                  <Text style={{ fontSize: 10, color: theme.t5 }} numberOfLines={1}>
                    {contact.role}
                    {contact.role && contact.company ? ' / ' : ''}
                    {contact.company}
                  </Text>
                ) : null}
              </View>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor:
                    score === 3
                      ? '#5BC97A' + '22'
                      : score === 2
                        ? theme.ac + '22'
                        : theme.warn + '22',
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '700',
                    color:
                      score === 3
                        ? '#5BC97A'
                        : score === 2
                          ? theme.ac
                          : theme.warn,
                  }}
                >
                  {score === 3 ? 'EMAIL' : score === 2 ? 'NAME' : 'FIRST'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <ActionBtn
            label={'Add ' + (speaker.name || 'as new') + ' as new contact'}
            theme={theme}
            onPress={onAddAsNew}
          />
        </View>
      ) : (
        <ActionBtn
          label={'Add ' + (speaker.name || 'as new') + ' as new contact'}
          primary
          theme={theme}
          onPress={onAddAsNew}
        />
      )}
    </View>
  );
}

function AiSuggestionCard({ contact, confidence, reason, theme, onPress }) {
  const conf = confidence || 'low';
  const confColor =
    conf === 'high' ? '#5BC97A' : conf === 'medium' ? theme.warn : theme.t5;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.purp + '50',
        backgroundColor: theme.purp + '10',
        marginBottom: 6,
      }}
    >
      <Avatar contact={contact} size={32} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {contact.name}
          </Text>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 4,
              backgroundColor: confColor + '22',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                color: confColor,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {conf}
            </Text>
          </View>
        </View>
        {reason ? (
          <Text style={{ fontSize: 11, color: theme.t5, marginTop: 2, lineHeight: 15 }}>
            {reason}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={14} color={theme.t5} />
    </TouchableOpacity>
  );
}

function ActionBtn({ label, onPress, primary, purple, warn, danger, disabled, theme }) {
  let borderColor = theme.brd2;
  let bgColor = theme.bg3;
  let textColor = theme.t3;

  if (primary) {
    borderColor = theme.ac;
    bgColor = theme.ac;
    textColor = '#fff';
  } else if (purple) {
    borderColor = theme.purp + '60';
    bgColor = theme.purp + '15';
    textColor = theme.purp;
  } else if (warn) {
    borderColor = theme.warn + '60';
    bgColor = theme.warn + '15';
    textColor = theme.warn;
  } else if (danger) {
    borderColor = theme.brdRed;
    bgColor = theme.bgRed;
    textColor = theme.red;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor,
        backgroundColor: bgColor,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: textColor,
          fontSize: 11,
          fontWeight: primary ? '700' : '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ContactPickerModal({ state, onClose, contacts, onPick }) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const visible = !!state;
  const item = state?.item || null;
  const scope = state?.scope || 'all';

  const baseList = useMemo(() => {
    if (!visible) return [];
    if (scope === 'firstName') {
      return findContactsByFirstName(item?.attendee?.name, contacts);
    }
    return (contacts || []).filter((c) => !c.archived);
  }, [visible, scope, item, contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((c) => {
      const hay = (
        c.name + ' ' + (c.company || '') + ' ' + (c.email || '')
      ).toLowerCase();
      return hay.includes(q);
    });
  }, [baseList, search]);

  function handleClose() {
    setSearch('');
    onClose();
  }

  const titleText =
    scope === 'firstName' ? 'Same first name' : 'Pick a contact';
  const subtitleText = item?.attendee?.name
    ? `Match for ${item.attendee.name}${item.attendee.email ? ' (' + item.attendee.email + ')' : ''}`
    : 'Pick the contact this meeting was with.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            backgroundColor: theme.bg,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.brd,
            width: '100%',
            maxWidth: 480,
            maxHeight: '80%',
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: theme.t1,
                  fontWeight: '600',
                  fontFamily: theme.fontDisplay,
                }}
              >
                {titleText}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <XIcon size={18} color={theme.t4} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 10 }}>
              {subtitleText}
            </Text>
            {scope === 'all' ? (
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search contacts..."
                placeholderTextColor={theme.t6}
                style={{
                  backgroundColor: theme.bg2,
                  borderWidth: 1,
                  borderColor: theme.brd2,
                  borderRadius: 10,
                  color: theme.t1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  fontSize: 13,
                  fontFamily: theme.fontBody,
                }}
              />
            ) : null}
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 18, paddingTop: 4 }}
          >
            {filtered.length === 0 ? (
              <Text
                style={{
                  fontSize: 12,
                  color: theme.t5,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  paddingVertical: 20,
                }}
              >
                {scope === 'firstName'
                  ? 'No contacts match that first name.'
                  : 'No contacts found.'}
              </Text>
            ) : (
              filtered.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onPick(c)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.bg2,
                    marginBottom: 6,
                  }}
                >
                  <Avatar contact={c} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500' }}>
                      {c.name}
                    </Text>
                    {c.company || c.role ? (
                      <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
                        {c.role}
                        {c.role && c.company ? ' / ' : ''}
                        {c.company}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronRight size={14} color={theme.t5} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}