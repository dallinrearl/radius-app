import { onAuthChange, signOut } from './src/lib/auth';
import AuthScreen from './src/screens/AuthScreen';
import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, Linking } from 'react-native';
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
import { EMPTY_CONTACT } from './src/constants';

import {
  InstrumentSerif_400Regular,
} from '@expo-google-fonts/instrument-serif';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  Newsreader_400Regular,
} from '@expo-google-fonts/newsreader';
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
    const recipient = (c.recipientName && c.recipientName.trim()) || c.name || '';
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
  // When set, Cancel/Save on the contact form returns to this view instead
  // of the default routing. Used so that creating a contact from the
  // review queue returns the user to the review queue, not the contacts list.
  const [formReturnView, setFormReturnView] = useState(null);
  const [dupeWarn, setDupeWarn] = useState(null);
  const [forceSavePending, setForceSavePending] = useState(false);
  const [toast, setToast] = useState(null);
  const [logModal, setLogModal] = useState({ visible: false, contact: null });
  const [locked, setLocked] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedListId, setSelectedListId] = useState(null);

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

  // Silent background sync once per app session, throttled to once per
  // 30 minutes via the lastSync timestamp. Fires when the user is loaded
  // in, signed in, unlocked, and has connected Granola.
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
          onProgress: () => {}, // silent
          onCommit: store.commit,
          addToReviewQueue: store.addToReviewQueue,
          granolaAiUnlocked: store.featureUnlocked('granolaAiProcessing'),
        });

        // Only show toast if anything actually happened
        if (result.hadAnything) {
          showToast('Granola: ' + result.summary, theme.ac);
        }
      } catch (e) {
        console.warn('Background Granola sync skipped:', e?.message);
        // Silent failure — do not bother the user
      }
    })();
  }, [store.loaded, user, locked, store.onboarded, store.contacts, store.myCard, store.commit, store.addToReviewQueue, theme.ac]);

  function showToast(msg, color) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2200);
  }

  // Sign the user out of Supabase. The onAuthChange listener will pick up
  // the change and flip user back to null, which routes us to AuthScreen.
  // No need to manually clear state — the auth gate handles it.
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

  // Handles the "Start trial" button on the paywall modal. Asks the Stripe
  // Edge Function to create a checkout session, then opens the URL in the
  // browser. Stripe redirects back via a `radius://` deep link after pay or
  // cancel, which is handled by the Linking listener below.
  async function handleStartTrial(plan = 'monthly') {
    try {
      const { url } = await createCheckoutSession({ plan, trial: true });
      store.dismissPaywall();
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Could not open checkout',
          'Please try again or contact support.',
        );
      }
    } catch (e) {
      console.error('handleStartTrial failed:', e?.message);
      Alert.alert('Could not start checkout', e?.message || 'Try again later.');
    }
  }

  // Open Stripe Customer Portal so trial users can manage their subscription
  // before the trial ends. Triggered by the trial banner's Manage button.
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

  // Listen for deep link returns from Stripe checkout. The Edge Function  // sets success_url and cancel_url to radius:// URLs that we intercept here.
  // On success, refresh the profile so the new tier is reflected.
  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (!url) return;
      if (url.startsWith('radius://checkout-success')) {
        showToast('Welcome to Pro!', theme.ac);
        // Refresh tier from server. Webhook may take a moment to fire so
        // give it a beat. Two retries in case the first is too quick.
        setTimeout(() => store.refetchProfile(), 1500);
        setTimeout(() => store.refetchProfile(), 4500);
      } else if (url.startsWith('radius://checkout-cancel')) {
        showToast('Checkout canceled', theme.t5);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    // Also check if app was opened with a URL from cold start.
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

  // Trial urgency toasts: fire once per threshold per device. Stored in
  // AsyncStorage so they don't repeat on every app open. Two thresholds:
  //   - 3 days remaining (warning level): "3 days left in trial. Manage..."
  //   - 1 day or less remaining (urgent): "Trial ends today. Manage..."
  // Each fires the FIRST time we observe the user crossing into that
  // threshold. After that, the banner alone reminds them.
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
      } catch (_) {
        // Toast is a nice-to-have; never block on storage errors.
      }
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
        const dupe = store.contacts.find(
          (c) =>
            !c.archived &&
            ((c.name && updated.name && c.name.toLowerCase() === updated.name.toLowerCase()) ||
              (c.email && updated.email && c.email.toLowerCase() === updated.email.toLowerCase())),
        );
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

  function saveCurrentForm() {
    const ok = commitContact(editForm, forceSavePending);
    if (ok) {
      const returnTo = formReturnView;
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setFormReturnView(null);
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
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setFormReturnView(null);
      if (returnTo) {
        setView(returnTo);
      } else {
        setView('list');
        setSelected(null);
      }
      showToast('Contact added');
    }
  }

  function archiveContact(c) {
    store.commit(store.contacts.map((x) => (x.id === c.id ? { ...x, archived: true } : x)));
    showToast(c.name + ' archived', theme.warn);
    if (selected?.id === c.id) {
      setSelected(null);
      setView('list');
    }
  }
  function unarchiveContact(c) {
    store.commit(store.contacts.map((x) => (x.id === c.id ? { ...x, archived: false } : x)));
    showToast(c.name + ' restored', theme.ac);
  }
  function deleteContact(c) {
    store.commit(store.contacts.filter((x) => x.id !== c.id));
    showToast('Deleted', theme.red);
    setSelected(null);
    setView('list');
  }

  function updateContact(updated) {
    store.commit(store.contacts.map((c) => (c.id === updated.id ? updated : c)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  // Wrapper around store.toggleContactOnList that also keeps the
  // currently-selected contact in sync (so the detail screen reflects
  // the change immediately).
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
    showToast('Logged with ' + c.name);
  }

  // Open the review queue screen.
  function openReviewQueue() {
    setView('review_queue');
  }

  // From a queue item, jump into the contact form pre-filled with the
  // attendee's name + email so the user can finish creating them. The
  // queue item is left in place; user can come back and confirm against
  // the new contact (which now has the email, so a future sync will match
  // automatically anyway).
  function createContactFromAttendee(item) {
    const att = item?.attendee || {};
    const prefill = {
      ...EMPTY_CONTACT,
      name: att.name || '',
      email: att.email || '',
    };
    if (att.email) {
      prefill.emails = [{ label: 'Personal', value: att.email }];
    }
    setEditForm(prefill);
    setEditFlash(true);
    setFormReturnView('review_queue');
    setView('edit');
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

  // Modals that should appear on every screen of the app go here. Each
  // return block below includes {globalModals} so the paywall, etc., can
  // surface from any view (DetailScreen, ContactForm, etc).
  const globalModals = (
    <PaywallModal
      visible={!!store.paywallReason}
      reason={store.paywallReason}
      onDismiss={store.dismissPaywall}
      onStartTrial={(plan) => handleStartTrial(plan || 'monthly')}
    />
  );

  // Trial banner sits at the very top of the screen for trial users only.
  // Rendered inline (not as a modal) so it pushes content down rather than
  // overlaying it. Each screen's return path includes {globalBanner} at the
  // top of its View wrapper.
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
    return <LockScreen pin={store.pin} onUnlock={() => setLocked(false)} />;
  }

  if (view === 'detail' && selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {globalBanner}
        <DetailScreen
          contact={selected}
          onBack={() => {
            setSelected(null);
            setView('list');
          }}
          onEdit={() => {
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
            setEditForm(null);
            setEditFlash(false);
            setDupeWarn(null);
            setFormReturnView(null);
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
            setView('list');
            setTab('settings');
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
    if (addMode === 'manual' || (addMode && addMode !== 'voice' && addMode !== 'card' && addMode !== 'import' && addMode !== 'receive' && addMode !== 'share' && view === 'edit')) {
      return null;
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {globalBanner}
        <AddScreen
          mode={addMode}
          setMode={(m) => {
            if (m === 'manual') {
              setEditForm({ ...EMPTY_CONTACT });
              setEditFlash(false);
              setView('edit');
              setAddMode(null);
              setTab('contacts');
            } else {
              setAddMode(m);
            }
          }}
          onComplete={(prefilled) => {
            setEditForm({ ...EMPTY_CONTACT, ...prefilled });
            setEditFlash(true);
            setView('edit');
            setAddMode(null);
            setTab('contacts');
          }}
          contacts={store.contacts}
          myCard={store.myCard}
          onCommit={store.commit}
          showToast={showToast}
          onBack={() => {
            setAddMode(null);
            setTab('contacts');
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
          archivedContacts={store.archivedContacts}
          onUnarchive={unarchiveContact}
          onPickContact={(c) => {
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