import { onAuthChange, signOut } from './src/lib/auth';
import AuthScreen from './src/screens/AuthScreen';
import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ThemeProvider, useTheme } from './src/styles/theme';
import { useAppStore } from './src/hooks/useAppStore';
import { runGranolaSync, shouldRunBackgroundSync } from './src/utils/granolaSync';
import { aiExtractFromVoice } from './src/utils/ai';
import NavBar from './src/components/NavBar';
import { Toast } from './src/components/Common';
import LogTouchpointModal from './src/components/LogTouchpointModal';
import ContactForm from './src/components/ContactForm';
import PaywallModal from './src/components/PaywallModal';
import TrialBanner from './src/components/TrialBanner';
import { createCheckoutSession, createPortalSession } from './src/lib/stripeApi';

import ContactsScreen from './src/screens/ContactsScreen';
import DetailScreen from './src/screens/DetailScreen';
import NextUpScreen from './src/screens/NextUpScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AddScreen from './src/screens/AddScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LockScreen from './src/screens/LockScreen';
import SecurityScreen from './src/screens/SecurityScreen';
import MailingListsScreen from './src/screens/MailingListsScreen';
import MailingListDetailScreen from './src/screens/MailingListDetailScreen';
import ReviewQueueScreen from './src/screens/ReviewQueueScreen';

import { addDays, isoToday } from './src/utils/helpers';
import { EMPTY_CONTACT, getDisplayName, splitLegacyName } from './src/constants';

import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
} from '@expo-google-fonts/karla';

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields) {
  return fields.map(csvEscape).join(',');
}

function buildMailingListCsv(list, contactsOnList) {
  const overrides = list.addressOverrides || {};
  const header = csvRow([
    'Recipient Name',
    'Address Line 1',
    'Address Line 2',
    'City',
    'State',
    'ZIP',
    'Country',
  ]);
  const rows = [];
  let skipped = 0;
  for (const c of contactsOnList) {
    const addresses = Array.isArray(c.addresses) ? c.addresses : [];
    if (addresses.length === 0) {
      skipped++;
      continue;
    }
    const idx = typeof overrides[c.id] === 'number' ? overrides[c.id] : 0;
    const addr = addresses[idx] || addresses[0];
    const recipient = (c.recipientName && c.recipientName.trim()) || getDisplayName(c) || '';
    rows.push(
      csvRow([
        recipient,
        addr.line1 || '',
        addr.line2 || '',
        addr.city || '',
        addr.state || '',
        addr.zip || '',
        addr.country || '',
      ]),
    );
  }
  return {
    csv: [header, ...rows].join('\r\n'),
    rowCount: rows.length,
    skipped,
  };
}

function AppInner() {
  const { theme, themeName } = useTheme();
  const store = useAppStore();
  const [tab, setTab] = useState('contacts');
  const [view, setView] = useState('list');
  const [addMode, setAddMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editFlash, setEditFlash] = useState(false);
  const [formReturnView, setFormReturnView] = useState(null);
  const [formReturnTab, setFormReturnTab] = useState(null);
  const [detailReturn, setDetailReturn] = useState(null);
  const [addReturn, setAddReturn] = useState(null);
  const [addDirectEntry, setAddDirectEntry] = useState(false);
  const [reviewQueueReturn, setReviewQueueReturn] = useState(null);
  const [dupeWarn, setDupeWarn] = useState(null);
  const [forceSavePending, setForceSavePending] = useState(false);
  const [toast, setToast] = useState(null);
  const [logModal, setLogModal] = useState({ visible: false, contact: null });
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedListId, setSelectedListId] = useState(null);
  const [pendingAttendeeItem, setPendingAttendeeItem] = useState(null);
  const [extractingForAttendee, setExtractingForAttendee] = useState(false);
  const [aiFillPrompt, setAiFillPrompt] = useState(null);

  useEffect(() => {
    if (store.loaded && store.pin) {
      setLocked(true);
    }
  }, [store.loaded, store.pin]);

  useEffect(() => {
    const subscription = onAuthChange((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const autoSyncRanRef = useRef(false);
  useEffect(() => {
    if (autoSyncRanRef.current) return;
    if (!store.loaded) return;
    if (!user) return;
    if (locked) return;
    if (!store.onboarded) return;
    if (!store.contacts) return;

    autoSyncRanRef.current = true;
    (async () => {
      try {
        const apiKey = await AsyncStorage.getItem('crm-granola-key');
        if (!apiKey) return;

        const should = await shouldRunBackgroundSync(30);
        if (!should) return;

        const result = await runGranolaSync({
          apiKey,
          contacts: store.contacts,
          myCard: store.myCard,
          onProgress: () => {},
          onCommit: store.commit,
          addToReviewQueue: store.addToReviewQueue,
          granolaAiUnlocked: store.featureUnlocked('granolaAiProcessing'),
        });

        if (result.hadAnything) {
          showToast('Granola: ' + result.summary, theme.ac);
        }
      } catch (e) {
        console.warn('Background Granola sync skipped:', e?.message);
      }
    })();
  }, [
    store.loaded,
    user,
    locked,
    store.onboarded,
    store.contacts,
    store.myCard,
    store.commit,
    store.addToReviewQueue,
    theme.ac,
  ]);

  function showToast(msg, color) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2200);
  }

  async function handleSignOut() {
    try {
      if (typeof signOut === 'function') {
        const result = await signOut();
        if (result && result.ok === false) {
          Alert.alert('Sign out failed', result.message || 'Try again.');
        }
      } else {
        Alert.alert(
          'Sign out unavailable',
          'No signOut export found in src/lib/auth. Please add one.',
        );
      }
    } catch (e) {
      console.error('handleSignOut failed:', e?.message);
      Alert.alert('Sign out failed', e?.message || 'Try again.');
    }
  }

  async function handleStartTrial(plan = 'monthly') {
    try {
      const { url } = await createCheckoutSession({ plan, trial: true });
      store.dismissPaywall();
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Could not open checkout', 'Please try again or contact support.');
      }
    } catch (e) {
      console.error('handleStartTrial failed:', e?.message);
      Alert.alert('Could not start checkout', e?.message || 'Try again later.');
    }
  }

  async function openBillingPortal() {
    try {
      const { url } = await createPortalSession();
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Could not open billing portal', 'Try again later.');
      }
    } catch (e) {
      console.error('openBillingPortal failed:', e?.message);
      Alert.alert('Could not open billing portal', e?.message || 'Try again later.');
    }
  }

  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (!url) return;
      if (url.startsWith('radius://checkout-success')) {
        showToast('Welcome to Pro!', theme.ac);
        setTimeout(() => store.refetchProfile(), 1500);
        setTimeout(() => store.refetchProfile(), 4500);
      } else if (url.startsWith('radius://checkout-cancel')) {
        showToast('Checkout canceled', theme.t5);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });
    return () => {
      try {
        sub.remove();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.ac]);

  useEffect(() => {
    if (!store.trialActive) return;
    if (store.trialDaysLeft == null) return;
    const days = store.trialDaysLeft;
    (async () => {
      try {
        if (days <= 1) {
          const seen = await AsyncStorage.getItem('crm-trial-toast-1d');
          if (!seen) {
            showToast('Trial ends today. Tap Manage to keep Pro.', theme.warn);
            await AsyncStorage.setItem('crm-trial-toast-1d', 'true');
          }
        } else if (days <= 3) {
          const seen = await AsyncStorage.getItem('crm-trial-toast-3d');
          if (!seen) {
            showToast(days + ' days left in trial. Manage anytime.', theme.warn);
            await AsyncStorage.setItem('crm-trial-toast-3d', 'true');
          }
        }
      } catch (_) {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.trialActive, store.trialDaysLeft]);

  function commitContact(updated, skipDupeCheck) {
    const exists = store.contacts.find((c) => c.id === updated.id);
    let next;
    if (exists) {
      next = store.contacts.map((c) => (c.id === updated.id ? updated : c));
    } else {
      if (!skipDupeCheck) {
        const updatedDisplay = getDisplayName(updated).toLowerCase();
        const updatedEmail = (updated.email || updated.emails?.[0]?.value || '').toLowerCase();
        const dupe = store.contacts.find((c) => {
          if (c.archived) return false;
          const cDisplay = getDisplayName(c).toLowerCase();
          const cEmail = (c.email || c.emails?.[0]?.value || '').toLowerCase();
          if (cDisplay && updatedDisplay && cDisplay === updatedDisplay) return true;
          if (cEmail && updatedEmail && cEmail === updatedEmail) return true;
          return false;
        });
        if (dupe) {
          setDupeWarn(dupe);
          return false;
        }
      }
      const id = updated.id || String(Date.now());
      next = [...store.contacts, { ...updated, id }];
    }
    store.commit(next);
    setDupeWarn(null);
    return true;
  }

  async function finalizeAttendeeContactIfNeeded(savedContact) {
    if (!pendingAttendeeItem) return;
    const item = pendingAttendeeItem;
    setPendingAttendeeItem(null);

    try {
      const expectedEntryId = 'granola_' + item.noteId + '_' + savedContact.id;
      const seededEntryId = 'granola_' + item.noteId + '_pending';
      const log = Array.isArray(savedContact.convLog) ? savedContact.convLog : [];
      const alreadyHasEntry = log.some(
        (e) => e.id === expectedEntryId || e.id === seededEntryId,
      );

      if (alreadyHasEntry) {
        const needsPromotion = log.some((e) => e.id === seededEntryId);
        if (needsPromotion) {
          const updated = store.contacts.map((c) => {
            if (c.id !== savedContact.id) return c;
            const cLog = Array.isArray(c.convLog) ? c.convLog : [];
            return {
              ...c,
              convLog: cLog.map((e) =>
                e.id === seededEntryId ? { ...e, id: expectedEntryId } : e,
              ),
            };
          });
          store.commit(updated);
        }
      } else {
        const date = item.meetingDate || isoToday();
        const text =
          (item.rawText || '').trim() ||
          (item.rawTranscript || '').trim() ||
          ('Meeting: ' + (item.meetingTitle || 'Untitled') + ' on ' + date);
        const entry = {
          id: expectedEntryId,
          date,
          text,
          type: 'meeting',
          source: 'granola',
          source_id: item.noteId,
        };
        if (item.rawTranscript && item.rawTranscript.trim()) {
          entry.rawTranscript = item.rawTranscript;
        }
        const updated = store.contacts.map((c) => {
          if (c.id !== savedContact.id) return c;
          const cLog = Array.isArray(c.convLog) ? c.convLog : [];
          if (cLog.some((e) => e.id === entry.id)) return c;
          return {
            ...c,
            convLog: [entry, ...cLog],
            lastContacted: date > (c.lastContacted || '') ? date : c.lastContacted,
          };
        });
        store.commit(updated);
      }

      if (item._aiSpeakerSource) {
        const { parentItemId, speakerIndex } = item._aiSpeakerSource;
        const parent = (store.reviewQueue || []).find((q) => q.id === parentItemId);
        if (parent) {
          const currentAi = Array.isArray(parent.aiAttendees)
            ? parent.aiAttendees
            : [];
          const nextAi = currentAi.filter((_, i) => i !== speakerIndex);
          if (nextAi.length === 0) {
            await store.removeFromReviewQueue(parentItemId);
          } else {
            await store.patchReviewQueueItem(parentItemId, {
              aiAttendees: nextAi,
            });
          }
        }
      } else {
        await store.removeFromReviewQueue(item.id);
      }
    } catch (e) {
      console.warn('finalizeAttendeeContactIfNeeded failed:', e?.message);
    }
  }

  function saveCurrentForm() {
    const ok = commitContact(editForm, forceSavePending);
    if (ok) {
      const returnTo = formReturnView;
      const returnTab = formReturnTab;
      const savedSnapshot = { ...editForm };
      if (selected && selected.id === editForm.id) {
        setSelected(editForm);
      }
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setFormReturnView(null);
      setFormReturnTab(null);
      finalizeAttendeeContactIfNeeded(savedSnapshot);
      if (returnTab) setTab(returnTab);
      if (returnTo) {
        setView(returnTo);
      } else {
        setView('list');
        setSelected(null);
      }
      showToast(editForm.id ? 'Saved' : 'Contact added');
    }
  }

  function forceSave() {
    setForceSavePending(true);
    const ok = commitContact(editForm, true);
    if (ok) {
      const returnTo = formReturnView;
      const returnTab = formReturnTab;
      const savedSnapshot = { ...editForm };
      if (selected && selected.id === editForm.id) {
        setSelected(editForm);
      }
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setFormReturnView(null);
      setFormReturnTab(null);
      finalizeAttendeeContactIfNeeded(savedSnapshot);
      if (returnTab) setTab(returnTab);
      if (returnTo) {
        setView(returnTo);
      } else {
        setView('list');
        setSelected(null);
      }
      showToast('Contact added');
    }
  }

  function popDetail() {
    const back = detailReturn;
    setSelected(null);
    setDetailReturn(null);
    if (back) {
      setTab(back.tab);
      setView(back.view);
    } else {
      setView('list');
    }
  }
  function archiveContact(c) {
    store.commit(store.contacts.map((x) => (x.id === c.id ? { ...x, archived: true } : x)));
    showToast(getDisplayName(c) + ' archived', theme.warn);
    if (selected?.id === c.id) {
      popDetail();
    }
  }
  function unarchiveContact(c) {
    store.commit(store.contacts.map((x) => (x.id === c.id ? { ...x, archived: false } : x)));
    showToast(getDisplayName(c) + ' restored', theme.ac);
  }
  function deleteContact(c) {
    store.removeContact(c.id);
    showToast('Deleted', theme.red);
    popDetail();
  }

  function updateContact(updated) {
    store.commit(store.contacts.map((c) => (c.id === updated.id ? updated : c)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  function toggleContactOnListLocal(contact, listId) {
    const updated = store.toggleContactOnList(contact, listId);
    if (selected?.id === contact.id) setSelected(updated);
  }

  function snoozeContact(c, daysCount) {
    const newLast = addDays(isoToday(), -getFreqDaysOffset(c.freq) + daysCount);
    updateContact({ ...c, lastContacted: newLast });
    showToast('Snoozed +' + daysCount + 'd', theme.warn);
  }

  function getFreqDaysOffset(freq) {
    const m = { '1week': 7, '2weeks': 14, '1month': 30, '3months': 90, '6months': 180, annual: 365 };
    return m[freq] || 0;
  }

  function logToday(c) {
    updateContact({ ...c, lastContacted: isoToday() });
    showToast('Logged contact');
  }

  function openLogModal(contact) {
    setLogModal({ visible: true, contact });
  }

  function saveLogEntry(entry) {
    const c = logModal.contact;
    if (!c) return;
    const updated = {
      ...c,
      lastContacted: entry.date,
      convLog: [entry, ...(c.convLog || [])],
    };
    updateContact(updated);
    setLogModal({ visible: false, contact: null });
    showToast('Logged with ' + getDisplayName(c));
  }

  function openReviewQueue() {
    setReviewQueueReturn({ tab: 'settings' });
    setView('review_queue');
  }

  function createContactFromAttendee(item) {
    const aiUnlocked = store.featureUnlocked('granolaAiProcessing');
    const transcript = item?.rawText || item?.rawTranscript || '';
    const hasTranscript = !!transcript.trim();

    if (aiUnlocked && hasTranscript) {
      setAiFillPrompt({ item });
    } else {
      openBlankFormFromAttendee(item);
    }
  }

  function openBlankFormFromAttendee(item) {
    const att = item?.attendee || {};
    const split = splitLegacyName(att.name || '');
    const transcript = (item?.rawTranscript || '').trim() || (item?.rawText || '').trim();
    const date = item?.meetingDate || isoToday();

    const prefill = {
      ...EMPTY_CONTACT,
      firstName: split.firstName,
      lastName: split.lastName,
      email: att.email || '',
    };
    if (att.email) {
      prefill.emails = [{ label: 'Personal', value: att.email }];
    }
    if (transcript || item?.noteId) {
      const fallbackText =
        'Meeting: ' + (item?.meetingTitle || 'Untitled') + ' on ' + date;
      const entry = {
        id: 'granola_' + item.noteId + '_pending',
        date,
        text: fallbackText,
        type: 'meeting',
        source: 'granola',
        source_id: item.noteId,
      };
      if (transcript) entry.rawTranscript = transcript;
      prefill.convLog = [entry];
      prefill.lastContacted = date;
    }

    setPendingAttendeeItem(item);
    setEditForm(prefill);
    setEditFlash(true);
    setFormReturnView('review_queue');
    setFormReturnTab(tab);
    setView('edit');
  }

  async function openAiFilledFormFromAttendee(item) {
    const att = item?.attendee || {};
    const transcript = item?.rawText || item?.rawTranscript || '';
    const date = item?.meetingDate || isoToday();

    setPendingAttendeeItem(item);
    setExtractingForAttendee(true);
    showToast('Reading the transcript...', theme.purp);

    try {
      const extracted = await aiExtractFromVoice(transcript, {
        myCard: store.myCard,
        attendeeName: att.name || '',
        summaryLength: store.meetingSummaryLength,
      });

      let extractedFirst = extracted.firstName || '';
      let extractedLast = extracted.lastName || '';
      if (!extractedFirst && !extractedLast && typeof extracted.name === 'string') {
        const split = splitLegacyName(extracted.name);
        extractedFirst = split.firstName;
        extractedLast = split.lastName;
      }
      if (!extractedFirst && !extractedLast && att.name) {
        const split = splitLegacyName(att.name);
        extractedFirst = split.firstName;
        extractedLast = split.lastName;
      }

      const {
        name: _droppedName,
        notes: _droppedNotes,
        meetingSummary: aiMeetingSummary,
        ...extractedRest
      } = extracted;

      const merged = {
        ...EMPTY_CONTACT,
        ...extractedRest,
        firstName: extractedFirst,
        lastName: extractedLast,
        email: att.email || extracted.email || '',
        notes: '',
      };
      if (att.email) {
        const aiEmails = Array.isArray(extracted.emails) ? extracted.emails : [];
        const alreadyHas = aiEmails.some(
          (e) => (e?.value || '').toLowerCase() === att.email.toLowerCase(),
        );
        merged.emails = alreadyHas
          ? aiEmails
          : [{ label: 'Personal', value: att.email }, ...aiEmails];
      }

      const summaryText = (aiMeetingSummary || '').trim();
      const fallbackText =
        'Meeting: ' + (item?.meetingTitle || 'Untitled') + ' on ' + date;
      const entry = {
        id: 'granola_' + item.noteId + '_pending',
        date,
        text: summaryText || fallbackText,
        type: 'meeting',
        source: 'granola',
        source_id: item.noteId,
      };
      if (transcript && transcript.trim()) {
        entry.rawTranscript = transcript;
      }
      merged.convLog = [entry];
      merged.lastContacted = date;

      setEditForm(merged);
      setEditFlash(true);
      setFormReturnView('review_queue');
      setFormReturnTab(tab);
      setView('edit');
      showToast('Review the details and save', theme.ac);
    } catch (e) {
      console.warn('AI extraction for attendee failed:', e?.message);
      showToast('AI extraction failed, filling name only', theme.warn);
      openBlankFormFromAttendee(item);
    }
    setExtractingForAttendee(false);
  }

  async function exportMailingList(list, contactsOnList) {
    try {
      const { csv, rowCount, skipped } = buildMailingListCsv(list, contactsOnList);
      if (rowCount === 0) {
        Alert.alert(
          'Nothing to export',
          skipped > 0
            ? `All ${skipped} contact${skipped === 1 ? '' : 's'} on this list are missing an address.`
            : 'This list is empty.',
        );
        return;
      }
      const filename =
        (list.name || 'mailing_list').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase() + '.csv';
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, '\uFEFF' + csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv' });
      }
      const skipText = skipped > 0 ? ` ${skipped} skipped (no address).` : '';
      showToast(`Exported ${rowCount} contact${rowCount === 1 ? '' : 's'}.${skipText}`);
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  }

  if (!store.loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.ac} size="large" />
      </View>
    );
  }

  const globalModals = (
    <>
      <PaywallModal
        visible={!!store.paywallReason}
        reason={store.paywallReason}
        onDismiss={store.dismissPaywall}
        onStartTrial={(plan) => handleStartTrial(plan || 'monthly')}
      />
      <AiFillPromptModal
        visible={!!aiFillPrompt}
        theme={theme}
        attendeeName={aiFillPrompt?.item?.attendee?.name || ''}
        onYes={() => {
          const item = aiFillPrompt?.item;
          setAiFillPrompt(null);
          if (item) openAiFilledFormFromAttendee(item);
        }}
        onNo={() => {
          const item = aiFillPrompt?.item;
          setAiFillPrompt(null);
          if (item) openBlankFormFromAttendee(item);
        }}
        onCancel={() => setAiFillPrompt(null)}
      />
    </>
  );

  const globalBanner = (
    <TrialBanner
      trialActive={store.trialActive}
      trialDaysLeft={store.trialDaysLeft}
      onManage={openBillingPortal}
    />
  );

  if (!authChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.t1} />
      </View>
    );
  }
  if (!user) {
    return <AuthScreen onAuthed={(u) => setUser(u)} />;
  }
  if (!store.onboarded) {
    return (
      <OnboardingScreen
        myCard={store.myCard}
        onSaveMyCard={store.saveMyCard}
        onFinish={store.finishOnboarding}
        allTags={store.visibleTags}
        onAddTag={store.addCustomTag}
        allInterests={store.visibleInterests}
        onAddInterest={store.addCustomInterest}
        contacts={store.contacts}
      />
    );
  }
  if (locked) {
    return (
      <LockScreen
        pin={store.pin}
        faceIdEnabled={store.faceIdEnabled}
        onUnlock={() => setLocked(false)}
      />
    );
  }

  if (extractingForAttendee) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        {globalBanner}
        <ActivityIndicator color={theme.purp} size="large" />
        <Text style={{ color: theme.t3, marginTop: 16, fontSize: 13 }}>
          Reading the transcript...
        </Text>
        <Text style={{ color: theme.t5, marginTop: 4, fontSize: 11 }}>
          Pulling out details about this contact
        </Text>
      </View>
    );
  }

  if (view === 'detail' && selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {globalBanner}
        <DetailScreen
          contact={selected}
          onBack={popDetail}
          onEdit={() => {
            setFormReturnView('detail');
            setFormReturnTab(tab);
            setEditForm({ ...selected });
            setView('edit');
          }}
          onUpdate={updateContact}
          onArchive={() => archiveContact(selected)}
          onDelete={() => deleteContact(selected)}
          showToast={showToast}
          mailingLists={store.mailingLists}
          onToggleContactOnList={toggleContactOnListLocal}
          consumeAiCall={store.consumeAiCall}
          aiRemaining={store.aiRemaining}
          effectiveTier={store.effectiveTier}
          myCard={store.myCard}
          meetingSummaryLength={store.meetingSummaryLength}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'edit' && editForm) {
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <ContactForm
          form={editForm}
          setForm={setEditForm}
          onSave={saveCurrentForm}
          onForceSave={forceSave}
          onCancel={() => {
            const returnTo = formReturnView;
            const returnTab = formReturnTab;
            setEditForm(null);
            setEditFlash(false);
            setDupeWarn(null);
            setFormReturnView(null);
            setFormReturnTab(null);
            setPendingAttendeeItem(null);
            if (returnTab) setTab(returnTab);
            if (returnTo) {
              setView(returnTo);
            } else if (selected) {
              setView('detail');
            } else {
              setView('list');
            }
          }}
          title={editForm.id ? 'Edit Contact' : 'Add Contact'}
          flash={editFlash}
          dupeWarn={dupeWarn}
          contacts={store.contacts}
          allTags={store.visibleTags}
          onAddTag={store.addCustomTag}
          allInterests={store.visibleInterests}
          onAddInterest={store.addCustomInterest}
          mailingLists={store.mailingLists}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'edit_mycard') {
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <ContactForm
          form={editForm}
          setForm={setEditForm}
          onSave={() => {
            store.saveMyCard(editForm);
            setEditForm(null);
            setView('list');
            setTab('settings');
            showToast('Card saved');
          }}
          onCancel={() => {
            setEditForm(null);
            setView('list');
            setTab('settings');
          }}
          title="My Card"
          contacts={store.contacts}
          allTags={store.visibleTags}
          onAddTag={store.addCustomTag}
          allInterests={store.visibleInterests}
          onAddInterest={store.addCustomInterest}
          mailingLists={store.mailingLists}
          isMyCard
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'security') {
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <SecurityScreen
          pin={store.pin}
          onSavePin={store.savePin}
          onRemovePin={store.removePin}
          faceIdEnabled={store.faceIdEnabled}
          onSaveFaceIdEnabled={store.saveFaceIdEnabled}
          displayName={store.displayName}
          onSaveDisplayName={store.saveDisplayName}
          username={store.username}
          onSaveUsername={store.saveUsername}
          password={store.password}
          onSavePassword={store.savePassword}
          onBack={() => setView('list')}
          showToast={showToast}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }

  if (view === 'mailing_lists') {
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <MailingListsScreen
          mailingLists={store.mailingLists}
          contacts={store.contacts}
          onCreateList={store.createMailingList}
          onRenameList={store.renameMailingList}
          onDeleteList={store.deleteMailingList}
          onPickList={(list) => {
            setSelectedListId(list.id);
            setView('mailing_list_detail');
          }}
          onBack={() => setView('list')}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }

  if (view === 'mailing_list_detail') {
    const list = store.mailingLists.find((l) => l.id === selectedListId);
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <MailingListDetailScreen
          mailingList={list}
          contacts={store.contacts}
          onSetAddressOverride={store.setAddressOverride}
          onRemoveFromList={(contact) => store.toggleContactOnList(contact, selectedListId)}
          onPickContact={(c) => {
            setDetailReturn({ tab: 'settings', view: 'mailing_list_detail' });
            setSelected(c);
            setView('detail');
          }}
          onExport={exportMailingList}
          onBack={() => {
            setSelectedListId(null);
            setView('mailing_lists');
          }}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }

  if (view === 'review_queue') {
    return (
      <View style={{ flex: 1 }}>
        {globalBanner}
        <ReviewQueueScreen
          reviewQueue={store.reviewQueue}
          contacts={store.contacts}
          myCard={store.myCard}
          onCommit={store.commit}
          onRemoveFromReviewQueue={store.removeFromReviewQueue}
          onPatchReviewQueueItem={store.patchReviewQueueItem}
          onCreateContactFromAttendee={createContactFromAttendee}
          onBack={() => {
            const back = reviewQueueReturn;
            setReviewQueueReturn(null);
            setView('list');
            setTab(back?.tab || 'settings');
          }}
          showToast={showToast}
          granolaAiUnlocked={store.featureUnlocked('granolaAiProcessing')}
          onShowPaywall={store.showPaywall}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }

  if (tab === 'add') {
    if (addMode === 'manual' || (addMode && addMode !== 'voice' && addMode !== 'card' && addMode !== 'import' && addMode !== 'receive' && addMode !== 'share' && addMode !== 'granola' && view === 'edit')) {
      return null;
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {globalBanner}
        <AddScreen
          mode={addMode}
          directEntry={addDirectEntry}
          setMode={(m) => {
            if (m === 'manual') {
              setFormReturnTab(addReturn?.tab || 'contacts');
              setAddReturn(null);
              setAddDirectEntry(false);
              setEditForm({ ...EMPTY_CONTACT });
              setEditFlash(false);
              setView('edit');
              setAddMode(null);
            } else if (m === 'granola') {
              setReviewQueueReturn({ tab: 'add' });
              setAddMode(null);
              setView('review_queue');
            } else {
              setAddMode(m);
            }
          }}
          onComplete={(prefilled) => {
            const seed = { ...EMPTY_CONTACT, ...prefilled };
            if (!seed.firstName && !seed.lastName && typeof seed.name === 'string' && seed.name.trim()) {
              const split = splitLegacyName(seed.name);
              seed.firstName = split.firstName;
              seed.lastName = split.lastName;
            }
            delete seed.name;
            setFormReturnTab(addReturn?.tab || 'contacts');
            setAddReturn(null);
            setAddDirectEntry(false);
            setEditForm(seed);
            setEditFlash(true);
            setView('edit');
            setAddMode(null);
          }}
          contacts={store.contacts}
          myCard={store.myCard}
          onCommit={store.commit}
          showToast={showToast}
          reviewQueue={store.reviewQueue}
          onBack={() => {
            const back = addReturn;
            setAddReturn(null);
            setAddDirectEntry(false);
            setAddMode(null);
            setTab(back?.tab || 'contacts');
          }}
        />
        {globalModals}
        <Toast toast={toast} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {globalBanner}
      {tab === 'contacts' && (
        <ContactsScreen
          contacts={store.contacts}
          activeContacts={store.activeContacts}
          overdueN={store.overdueN}
          allTags={store.visibleTags}
          onPickContact={(c) => {
            setDetailReturn({ tab: 'contacts', view: 'list' });
            setSelected(c);
            setView('detail');
          }}
          onArchive={archiveContact}
          onLogTouch={openLogModal}
          onLogToday={logToday}
          showToast={showToast}
          samplesBannerDismissed={store.samplesBannerDismissed}
          onClearSamples={store.clearSampleContacts}
          onDismissSamplesBanner={store.dismissSamplesBanner}
          contactsFetchError={store.contactsFetchError}
          contactsFetching={store.contactsFetching}
          onRefetchContacts={store.refetchContacts}
        />
      )}
      {tab === 'nextup' && (
        <NextUpScreen
          activeContacts={store.activeContacts}
          allTags={store.visibleTags}
          onPickContact={(c) => {
            setDetailReturn({ tab: 'nextup', view: 'list' });
            setSelected(c);
            setView('detail');
          }}
          onLogTouch={openLogModal}
          onSnooze={snoozeContact}
          myCard={store.myCard}
          aiUnlocked={store.featureUnlocked('aiOutreaches') || store.effectiveTier !== 'free'}
          consumeAiCall={store.consumeAiCall}
          onShowPaywall={store.showPaywall}
        />
      )}
      {tab === 'stats' && <StatsScreen activeContacts={store.activeContacts} />}
      {tab === 'settings' && (
        <SettingsScreen
          myCard={store.myCard}
          onEditMyCard={() => {
            setEditForm({ ...store.myCard });
            setView('edit_mycard');
          }}
          onShareMyCard={() => {
            setAddReturn({ tab: 'settings' });
            setAddDirectEntry(true);
            setAddMode('share');
            setTab('add');
          }}
          customTags={store.customTags}
          hiddenTags={store.hiddenTags}
          onSaveCustomTags={store.saveCustomTags}
          onSaveHiddenTags={store.saveHiddenTags}
          customInterests={store.customInterests}
          hiddenInterests={store.hiddenInterests}
          onSaveCustomInterests={store.saveCustomInterests}
          onSaveHiddenInterests={store.saveHiddenInterests}
          contacts={store.contacts}
          onCommit={store.commit}
          onDeleteAllContacts={store.removeAllNonSampleContacts}
          archivedContacts={store.archivedContacts}
          onUnarchive={unarchiveContact}
          onPickContact={(c) => {
            setDetailReturn({ tab: 'settings', view: 'list' });
            setSelected(c);
            setView('detail');
          }}
          onSecurityPress={() => setView('security')}
          onMailingListsPress={() => setView('mailing_lists')}
          mailingLists={store.mailingLists}
          onReplayWalkthrough={store.resetOnboarding}
          showToast={showToast}
          reviewQueue={store.reviewQueue}
          onAddToReviewQueue={store.addToReviewQueue}
          onRemoveFromReviewQueue={store.removeFromReviewQueue}
          onClearReviewQueue={store.clearReviewQueue}
          onOpenReviewQueue={openReviewQueue}
          granolaAiUnlocked={store.featureUnlocked('granolaAiProcessing')}
          tier={store.tier}
          effectiveTier={store.effectiveTier}
          trialActive={store.trialActive}
          trialDaysLeft={store.trialDaysLeft}
          aiCallsCount={store.aiCallsCount}
          aiRemaining={store.aiRemaining}
          hasStripeCustomer={!!store.profile?.stripe_customer_id}
          onShowPaywall={store.showPaywall}
          onSignOut={handleSignOut}
          meetingSummaryLength={store.meetingSummaryLength}
          onSaveMeetingSummaryLength={store.saveMeetingSummaryLength}
          notificationsEnabled={store.notificationsEnabled}
          notifOverdue={store.notifOverdue}
          notifBirthdays={store.notifBirthdays}
          hasPushToken={store.hasPushToken}
          onSaveNotificationPrefs={store.saveNotificationPrefs}
          onRegisterPushToken={store.registerPushToken}
          onImportContactsPress={() => {
            setAddReturn({ tab: 'settings' });
            setAddDirectEntry(true);
            setAddMode('import');
            setTab('add');
          }}
        />
      )}

      <NavBar
        tab={tab}
        setTab={(t) => {
          setTab(t);
          setSelected(null);
          setView('list');
        }}
        onAddPress={() => {
          setAddReturn({ tab });
          setAddDirectEntry(false);
          setTab('add');
          setAddMode(null);
        }}
        overdueN={store.overdueN}
      />

      <LogTouchpointModal
        visible={logModal.visible}
        contact={logModal.contact}
        onClose={() => setLogModal({ visible: false, contact: null })}
        onSave={saveLogEntry}
      />

      {globalModals}
      <Toast toast={toast} />
    </View>
  );
}

function AiFillPromptModal({ visible, theme, attendeeName, onYes, onNo, onCancel }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onCancel}
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
            maxWidth: 420,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              color: theme.t1,
              fontWeight: '600',
              marginBottom: 8,
              fontFamily: theme.fontDisplay,
            }}
          >
            Have AI fill in details?
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: theme.t4,
              lineHeight: 19,
              marginBottom: 18,
            }}
          >
            {attendeeName
              ? `AI can read the meeting transcript and pull out everything ${attendeeName} mentioned. Company, role, family, interests, deals. To pre-fill the contact card for you to review.`
              : 'AI can read the meeting transcript and pull out everything mentioned about this contact. Company, role, family, interests, deals. To pre-fill the contact card for you to review.'}
          </Text>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={onYes}
              activeOpacity={0.8}
              style={{
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: theme.purp,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                Yes, let AI fill it in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNo}
              activeOpacity={0.8}
              style={{
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: theme.bg3,
                borderWidth: 1,
                borderColor: theme.brd2,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.t2, fontSize: 13, fontWeight: '600' }}>
                No, I'll fill it in myself
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.8}
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.t5, fontSize: 12 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          InstrumentSerif_400Regular,
          DMSans_400Regular,
          DMSans_500Medium,
          DMSans_600SemiBold,
          DMSans_700Bold,
          Newsreader_400Regular,
          Karla_400Regular,
          Karla_500Medium,
          Karla_600SemiBold,
          Karla_700Bold,
        });
      } catch (_) {}
      setFontsLoaded(true);
    })();
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B1121',
        }}
      >
        <ActivityIndicator color="#3B6EE6" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarShim />
          <AppInner />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function StatusBarShim() {
  const { themeName } = useTheme();
  return <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />;
}