import React, { useState, useMemo } from 'react';
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
import { ChevronDown, ChevronRight, XIcon } from '../components/Icons';
import { fmtDate, isoToday } from '../utils/helpers';
import { groupByMeeting, findContactsByFirstName } from '../utils/reviewQueue';
import { aiExtractMeetingNote, aiSuggestContactsForAttendee, aiSummarizeMeetingForReview } from '../utils/ai';
import { EMPTY_CONTACT } from '../constants';

// ReviewQueueScreen
//
// Lists Granola sync items that need user triage. Items come from
// store.reviewQueue. Each item holds the raw transcript / raw text so we
// can run aiExtractMeetingNote on demand once the user picks a contact.
//
// Per-item triage paths:
//   - Confirm suggestion (when sync provided one)
//   - Pick a different contact (search-all picker)
//   - Same-first-name quick filter (when no suggestion)
//   - Create a new contact pre-filled with attendee info
//   - Dismiss as "not a contact"

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
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [pickerOpen, setPickerOpen] = useState(null); // null | { item, scope: 'all'|'firstName' }
  const [busyItemId, setBusyItemId] = useState(null);
  // Tracks which items have an in-flight AI suggestion request
  const [aiBusyItemId, setAiBusyItemId] = useState(null);
  // Tracks which meeting (by noteId) has an in-flight summary request
  const [summaryBusyNoteId, setSummaryBusyNoteId] = useState(null);
  // Tracks which meetings have transcript expanded inline
  const [transcriptOpenNoteIds, setTranscriptOpenNoteIds] = useState(() => new Set());

  // Hide any items where the attendee is the user themselves. Catches
  // stale items left over from before we started skipping the user by name.
  // Pure display filter — items can still be dismissed via the X to remove
  // them from storage permanently.
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
      if (email && myEmails.has(email)) return false;
      if (name && myNames.has(name)) return false;
      return true;
    });
  }, [reviewQueue, myCard]);

  const grouped = useMemo(() => groupByMeeting(visibleQueue), [visibleQueue]);
  const totalCount = visibleQueue.length;

  // Apply a chosen contact to a queue item: extract via Claude, append entry,
  // remove from queue. Used by Confirm and the search picker.
  async function applyContactToItem(item, contact) {
    if (!item || !contact || !onCommit) return;
    setBusyItemId(item.id);
    try {
      const date = item.meetingDate || isoToday();
      const rawText = item.rawText || '';
      const transcriptText = item.rawTranscript || '';

      let extracted = '';
      try {
        extracted = await aiExtractMeetingNote(contact, rawText, myCard);
      } catch (e) {
        console.warn('aiExtractMeetingNote failed:', e?.message);
        extracted =
          'Imported from meeting "' +
          (item.meetingTitle || 'Untitled') +
          '" on ' +
          fmtDate(date) +
          '. (AI extraction failed; transcript saved on entry.)';
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

      // Append to the contact's convLog (avoid double-append if same source_id+contact already there)
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

  async function dismissItem(item) {
    setBusyItemId(item.id);
    try {
      await onRemoveFromReviewQueue(item.id);
      showToast && showToast('Dismissed');
    } catch (_) {}
    setBusyItemId(null);
  }

  async function fetchAiSuggestions(item) {
    if (!item || !onPatchReviewQueueItem) return;
    // Tier gate: free users see the paywall instead of running the call.
    if (!granolaAiUnlocked) {
      onShowPaywall && onShowPaywall('granola_ai_processing');
      return;
    }
    setAiBusyItemId(item.id);
    try {
      // Send a transcript snippet rather than the full text to keep cost/tokens low.
      const snippet = (item.rawTranscript || item.rawText || '').slice(0, 1500);
      const suggestions = await aiSuggestContactsForAttendee({
        attendee: item.attendee,
        meetingTitle: item.meetingTitle,
        meetingDate: item.meetingDate,
        transcriptSnippet: snippet,
        contacts,
      });
      // Cache on the queue item so re-opening the screen doesn't re-fetch
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

  // Fetch a contact-agnostic AI summary for a meeting. Caches it on every
  // queue item that shares the same noteId, so all attendees in that meeting
  // can see it without re-fetching.
  async function fetchMeetingSummary(group) {
    if (!group?.noteId || !onPatchReviewQueueItem) return;
    if (summaryBusyNoteId === group.noteId) return;
    // Tier gate
    if (!granolaAiUnlocked) {
      onShowPaywall && onShowPaywall('granola_ai_processing');
      return;
    }

    // Pick a representative item to source rawText from
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
      // Patch every item in this meeting with the summary
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 100,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onPress={onBack} />
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
          Review queue
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5, marginBottom: 18, lineHeight: 17 }}>
          {totalCount === 0
            ? "You're all caught up."
            : `${totalCount} attendee${totalCount === 1 ? '' : 's'} from recent meetings need to be matched to contacts.`}
        </Text>

        {totalCount === 0 ? (
          <EmptyState theme={theme} />
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
              theme={theme}
              getContactById={getContactById}
              granolaAiUnlocked={granolaAiUnlocked}
              onConfirm={(item, contact) => applyContactToItem(item, contact)}
              onPickDifferent={(item) => setPickerOpen({ item, scope: 'all' })}
              onPickSameFirstName={(item) => setPickerOpen({ item, scope: 'firstName' })}
              onFetchAiSuggestions={fetchAiSuggestions}
              onFetchMeetingSummary={fetchMeetingSummary}
              onToggleTranscript={toggleTranscript}
              onCreateNew={handleCreateNewContact}
              onDismiss={dismissItem}
            />
          ))
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

// ----- Empty state -----

function EmptyState({ theme }) {
  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 30, marginBottom: 8 }}>✓</Text>
      <Text style={{ fontSize: 14, color: theme.t2, fontWeight: '600', marginBottom: 4 }}>
        Nothing to review
      </Text>
      <Text style={{ fontSize: 12, color: theme.t5, textAlign: 'center', lineHeight: 17 }}>
        Sync your Granola meetings and any attendees that can't be matched automatically will show up here.
      </Text>
    </View>
  );
}

// ----- One meeting card with all its pending attendees -----

function MeetingGroup({
  group,
  contacts,
  busyItemId,
  aiBusyItemId,
  summaryBusy,
  transcriptOpen,
  theme,
  getContactById,
  granolaAiUnlocked,
  onConfirm,
  onPickDifferent,
  onPickSameFirstName,
  onFetchAiSuggestions,
  onFetchMeetingSummary,
  onToggleTranscript,
  onCreateNew,
  onDismiss,
}) {
  // The AI summary lives on every queue item that shares the noteId. Pull it
  // from the first item that has one. Same for the raw transcript.
  const meetingSummary = group.items.find((i) => i.meetingSummary)?.meetingSummary || '';
  const transcriptText =
    group.items.find((i) => i.rawTranscript)?.rawTranscript ||
    group.items.find((i) => i.rawText)?.rawText ||
    '';

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.brd,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <View style={{ marginBottom: 10 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: theme.ac,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {group.meetingDate ? fmtDate(group.meetingDate) : 'No date'}
        </Text>
        <Text
          style={{ fontSize: 14, color: theme.t1, fontWeight: '600' }}
          numberOfLines={2}
        >
          {group.meetingTitle}
        </Text>
      </View>

      {/* Meeting context: summary + transcript toggle */}
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

      {group.items.map((item, idx) => (
        <QueueItemRow
          key={item.id}
          item={item}
          contacts={contacts}
          isLast={idx === group.items.length - 1}
          busy={busyItemId === item.id}
          aiBusy={aiBusyItemId === item.id}
          theme={theme}
          getContactById={getContactById}
          granolaAiUnlocked={granolaAiUnlocked}
          onConfirm={onConfirm}
          onPickDifferent={onPickDifferent}
          onPickSameFirstName={onPickSameFirstName}
          onFetchAiSuggestions={onFetchAiSuggestions}
          onCreateNew={onCreateNew}
          onDismiss={onDismiss}
        />
      ))}
    </View>
  );
}

// Shows the meeting-level context: AI summary (when fetched) + transcript
// toggle. Both help the user decide which contact each attendee maps to.
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
      {/* Summary section */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                <Text style={{ fontSize: 9, color: theme.warn, fontWeight: '700' }}>PRO</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      )}

      {/* Transcript toggle row */}
      {hasTranscript ? (
        <View style={{ marginTop: meetingSummary ? 0 : 8 }}>
          <TouchableOpacity
            onPress={onToggleTranscript}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <View style={{ transform: [{ rotate: transcriptOpen ? '180deg' : '0deg' }] }}>
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

// ----- One pending attendee within a meeting card -----

function QueueItemRow({
  item,
  contacts,
  isLast,
  busy,
  aiBusy,
  theme,
  getContactById,
  granolaAiUnlocked,
  onConfirm,
  onPickDifferent,
  onPickSameFirstName,
  onFetchAiSuggestions,
  onCreateNew,
  onDismiss,
}) {
  const suggestedContact = item.suggestion?.contactId
    ? getContactById(item.suggestion.contactId)
    : null;
  const sameFirstName = useMemo(
    () => findContactsByFirstName(item.attendee?.name, contacts),
    [item.attendee?.name, contacts],
  );

  // AI suggestions cached on the item by the parent screen.
  // null = never fetched, [] = fetched but empty, [...] = have results
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
      {/* Attendee header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {item.attendee?.name || '(no name)'}
          </Text>
          {item.attendee?.email ? (
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 1 }}>
              {item.attendee.email}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(item)}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 2 }}
        >
          <XIcon size={14} color={theme.t6} />
        </TouchableOpacity>
      </View>

      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <ActivityIndicator color={theme.ac} size="small" />
          <Text style={{ fontSize: 12, color: theme.t5 }}>Working...</Text>
        </View>
      ) : (
        <>
          {/* Suggestion (if any) */}
          {suggestedContact ? (
            <View style={{ marginTop: 10 }}>
              <Text
                style={{ fontSize: 10, color: theme.t5, marginBottom: 6, fontStyle: 'italic' }}
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
            // No sync-time suggestion. Show on-demand options + AI fallback.
            <View style={{ marginTop: 10 }}>
              {/* AI suggestion results */}
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

              {/* Action buttons */}
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

                {/* AI suggestion button: only show if we haven't fetched yet */}
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

// One AI-suggested contact card. Tapping it confirms the match.
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

function ActionBtn({ label, onPress, primary, purple, disabled, theme }) {
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

// ----- Contact picker modal -----
//
// Used for both "Different contact" (scope: all) and the same-first-name
// quick path (scope: firstName, pre-filtered).

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
      const hay = (c.name + ' ' + (c.company || '') + ' ' + (c.email || '')).toLowerCase();
      return hay.includes(q);
    });
  }, [baseList, search]);

  function handleClose() {
    setSearch('');
    onClose();
  }

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
              <Text style={{ fontSize: 16, color: theme.t1, fontWeight: '600', fontFamily: theme.fontDisplay }}>
                {scope === 'firstName' ? 'Same first name' : 'Pick a contact'}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <XIcon size={18} color={theme.t4} />
              </TouchableOpacity>
            </View>
            {item?.attendee?.name ? (
              <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 10 }}>
                Match for {item.attendee.name}
                {item.attendee.email ? ' (' + item.attendee.email + ')' : ''}
              </Text>
            ) : null}
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

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 18, paddingTop: 4 }}>
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
                    {(c.company || c.role) ? (
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