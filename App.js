import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';

import { ThemeProvider, useTheme } from './src/styles/theme';
import { useAppStore } from './src/hooks/useAppStore';
import NavBar from './src/components/NavBar';
import { Toast } from './src/components/Common';
import LogTouchpointModal from './src/components/LogTouchpointModal';
import ContactForm from './src/components/ContactForm';

import ContactsScreen from './src/screens/ContactsScreen';
import DetailScreen from './src/screens/DetailScreen';
import NextUpScreen from './src/screens/NextUpScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AddScreen from './src/screens/AddScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LockScreen from './src/screens/LockScreen';
import SecurityScreen from './src/screens/SecurityScreen';

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

function AppInner() {
  const { theme, themeName } = useTheme();
  const store = useAppStore();
  const [tab, setTab] = useState('contacts');
  const [view, setView] = useState('list'); // list | detail | edit | edit_mycard | add | security
  const [addMode, setAddMode] = useState(null); // null | manual | voice | card | import | receive | share
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editFlash, setEditFlash] = useState(false);
  const [dupeWarn, setDupeWarn] = useState(null);
  const [forceSavePending, setForceSavePending] = useState(false);
  const [toast, setToast] = useState(null);
  const [logModal, setLogModal] = useState({ visible: false, contact: null });
  const [locked, setLocked] = useState(false);

  // PIN gating on launch
  useEffect(() => {
    if (store.loaded && store.pin) {
      setLocked(true);
    }
  }, [store.loaded, store.pin]);

  function showToast(msg, color) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2200);
  }

  // === Contact CRUD ===
  function commitContact(updated, skipDupeCheck) {
    const exists = store.contacts.find((c) => c.id === updated.id);
    let next;
    if (exists) {
      next = store.contacts.map((c) => (c.id === updated.id ? updated : c));
    } else {
      // New: dupe check
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
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setView('list');
      setSelected(null);
      showToast(editForm.id ? 'Saved' : 'Contact added');
    }
  }

  function forceSave() {
    setForceSavePending(true);
    const ok = commitContact(editForm, true);
    if (ok) {
      setEditForm(null);
      setEditFlash(false);
      setForceSavePending(false);
      setView('list');
      setSelected(null);
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

  // === Render gating ===
  if (!store.loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.ac} size="large" />
      </View>
    );
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

  // === Sub-views ===
  if (view === 'detail' && selected) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
        />
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'edit' && editForm) {
    return (
      <View style={{ flex: 1 }}>
        <ContactForm
          form={editForm}
          setForm={setEditForm}
          onSave={saveCurrentForm}
          onForceSave={forceSave}
          onCancel={() => {
            setEditForm(null);
            setEditFlash(false);
            setDupeWarn(null);
            if (selected) setView('detail');
            else setView('list');
          }}
          title={editForm.id ? 'Edit Contact' : 'Add Contact'}
          flash={editFlash}
          dupeWarn={dupeWarn}
          contacts={store.contacts}
          allTags={store.visibleTags}
          onAddTag={store.addCustomTag}
          allInterests={store.visibleInterests}
          onAddInterest={store.addCustomInterest}
        />
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'edit_mycard') {
    return (
      <View style={{ flex: 1 }}>
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
          isMyCard
        />
        <Toast toast={toast} />
      </View>
    );
  }
  if (view === 'security') {
    return (
      <View style={{ flex: 1 }}>
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
        <Toast toast={toast} />
      </View>
    );
  }

  // === Add flow ===
  if (tab === 'add') {
    if (addMode === 'manual' || (addMode && addMode !== 'voice' && addMode !== 'card' && addMode !== 'import' && addMode !== 'receive' && addMode !== 'share' && view === 'edit')) {
      return null; // handled above
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
        <Toast toast={toast} />
      </View>
    );
  }

  // === Main tabbed views ===
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
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
          onReplayWalkthrough={store.resetOnboarding}
          showToast={showToast}
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
