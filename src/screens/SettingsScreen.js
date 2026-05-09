import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import {
  ChevronDown,
  ChevronRight,
  PenIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
  LockIcon,
  RefreshIcon,
  DownloadIcon,
  UploadIcon,
  ArchiveIcon,
  UsersIcon,
  CardIcon,
  TagIcon,
  HeartIcon,
  XIcon,
  MailIcon,
  ChatIcon,
} from '../components/Icons';
import { Avatar, Toggle, StyledInput } from '../components/Common';
import { getTagColor, makeVcf, isoToday } from '../utils/helpers';
import { DEFAULT_INTERESTS } from '../constants';
import {
  TAGS as MASTER_TAGS,
  SUBCATEGORIES,
  COMMON_TAG_LABELS,
} from '../constants/tagLibrary';
import { testKey as granolaTestKey } from '../utils/granola';
import { runGranolaSync } from '../utils/granolaSync';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';

const GRANOLA_KEY_STORAGE = 'crm-granola-key';
const GRANOLA_LAST_SYNC_STORAGE = 'crm-granola-last-sync';
const GRANOLA_PROCESSED_IDS_STORAGE = 'crm-granola-processed-ids';

export default function SettingsScreen({
  myCard,
  onEditMyCard,
  onShareMyCard,
  customTags,
  hiddenTags,
  onSaveCustomTags,
  onSaveHiddenTags,
  customInterests,
  hiddenInterests,
  onSaveCustomInterests,
  onSaveHiddenInterests,
  contacts,
  onCommit,
  archivedContacts,
  onUnarchive,
  onPickContact,
  onSecurityPress,
  onMailingListsPress,
  mailingLists,
  onReplayWalkthrough,
  showToast,
  reviewQueue,
  onAddToReviewQueue,
  onRemoveFromReviewQueue,
  onClearReviewQueue,
  onOpenReviewQueue,
}) {
  const { theme, themeName, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [openSection, setOpenSection] = useState(null);

  function toggleSection(s) {
    setOpenSection(openSection === s ? null : s);
  }

  async function importContacts() {
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow Contacts access.');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
        Contacts.Fields.Company,
        Contacts.Fields.JobTitle,
      ],
    });
    if (!data?.length) {
      Alert.alert('No contacts found');
      return;
    }
    const newOnes = data
      .filter((d) => d.name)
      .map((d, i) => ({
        id: 'imp_' + Date.now() + '_' + i,
        name: d.name,
        company: d.company || '',
        role: d.jobTitle || '',
        phone: d.phoneNumbers?.[0]?.number || '',
        email: d.emails?.[0]?.email || '',
        howMet: '',
        howHelp: '',
        topics: '',
        notes: '',
        lastContacted: '',
        tags: [],
        freq: 'never',
        priority: false,
        birthday: '',
        timezone: '',
        location: '',
        hometown: '',
        married: null,
        spouseName: '',
        kids: [],
        interests: [],
        experience: '',
        pastCompanies: [],
        photo: '',
        convLog: [],
        archived: false,
      }));
    onCommit([...contacts, ...newOnes]);
    showToast('Imported ' + newOnes.length + ' contacts', theme.ac);
  }

  async function exportAll() {
    try {
      const allVcf = contacts.filter((c) => !c.archived).map(makeVcf).join('\r\n');
      const path = FileSystem.cacheDirectory + 'radius_contacts.vcf';
      await FileSystem.writeAsStringAsync(path, allVcf);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/vcard' });
      }
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  }

  async function backupAll() {
    try {
      const data = JSON.stringify({
        contacts,
        myCard,
        customTags,
        hiddenTags,
        customInterests,
        hiddenInterests,
        mailingLists,
        exportedAt: new Date().toISOString(),
      });
      const path = FileSystem.cacheDirectory + 'radius_backup.json';
      await FileSystem.writeAsStringAsync(path, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
      }
    } catch (e) {
      Alert.alert('Backup failed', e.message);
    }
  }

  const listsCount = Array.isArray(mailingLists) ? mailingLists.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 120,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 20,
            fontFamily: theme.fontDisplay,
          }}
        >
          Settings
        </Text>

        {/* My Card */}
        <SettingsSection
          icon={<CardIcon size={18} color={theme.ac} />}
          title="My Card"
          subtitle={myCard.name || 'Set up your contact card'}
          open={openSection === 'card'}
          onPress={() => toggleSection('card')}
        >
          <View style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar contact={myCard} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600' }}>
                  {myCard.name || 'No name set'}
                </Text>
                <Text style={{ color: theme.t5, fontSize: 11 }}>
                  {myCard.role}
                  {myCard.role && myCard.company ? ' / ' : ''}
                  {myCard.company}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={onEditMyCard}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: theme.bgAc,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <PenIcon size={14} color={theme.ac} />
                <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onShareMyCard}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: theme.bg3,
                  borderWidth: 1,
                  borderColor: theme.brd2,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.t3, fontSize: 12, fontWeight: '600' }}>Share QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        {/* Theme Toggle */}
        <View
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {themeName === 'dark' ? (
            <MoonIcon size={18} color={theme.purp} />
          ) : (
            <SunIcon size={18} color={theme.warn} />
          )}
          <Text style={{ flex: 1, color: theme.t1, fontSize: 14, fontWeight: '500' }}>
            Theme
          </Text>
          <Text style={{ color: theme.t5, fontSize: 12, marginRight: 4 }}>
            {themeName === 'dark' ? 'Dark' : 'Light'}
          </Text>
          <Toggle value={themeName === 'dark'} onValueChange={toggleTheme} color={theme.purp} />
        </View>

        {/* Tags */}
        <SettingsSection
          icon={<TagIcon size={18} color={theme.info} />}
          title="Tags"
          subtitle="Categorize your contacts"
          open={openSection === 'tags'}
          onPress={() => toggleSection('tags')}
        >
          <TagsManager
            customTags={customTags}
            hiddenTags={hiddenTags}
            onSaveCustom={onSaveCustomTags}
            onSaveHidden={onSaveHiddenTags}
          />
        </SettingsSection>

        {/* Interests */}
        <SettingsSection
          icon={<HeartIcon size={18} color={theme.purp} />}
          title="Interests"
          subtitle="Hobbies and things people care about"
          open={openSection === 'interests'}
          onPress={() => toggleSection('interests')}
        >
          <InterestsManager
            customInterests={customInterests}
            hiddenInterests={hiddenInterests}
            onSaveCustom={onSaveCustomInterests}
            onSaveHidden={onSaveHiddenInterests}
          />
        </SettingsSection>

        {/* Mailing Lists */}
        <TouchableOpacity
          onPress={onMailingListsPress}
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <MailIcon size={18} color={theme.info} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>
              Mailing Lists
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              {listsCount === 0
                ? 'Create lists for cards, invites, and more'
                : `${listsCount} ${listsCount === 1 ? 'list' : 'lists'}`}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        {/* Integrations */}
        <SettingsSection
          icon={<ChatIcon size={18} color={theme.ac} />}
          title="Integrations"
          subtitle="Connect Granola for automatic meeting notes"
          open={openSection === 'integrations'}
          onPress={() => toggleSection('integrations')}
        >
          <GranolaIntegration
            myCard={myCard}
            contacts={contacts}
            onCommit={onCommit}
            showToast={showToast}
            reviewQueue={reviewQueue}
            onAddToReviewQueue={onAddToReviewQueue}
            onClearReviewQueue={onClearReviewQueue}
            onOpenReviewQueue={onOpenReviewQueue}
          />
        </SettingsSection>

        {/* Security */}
        <TouchableOpacity
          onPress={onSecurityPress}
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <LockIcon size={18} color={theme.warn} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>Security</Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              PIN, password, and account info
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        {/* Data */}
        <SettingsSection
          icon={<DownloadIcon size={18} color={theme.ac} />}
          title="Data"
          subtitle="Import, export, backup"
          open={openSection === 'data'}
          onPress={() => toggleSection('data')}
        >
          <View style={{ padding: 14, gap: 8 }}>
            <DataRow
              icon={<UsersIcon size={16} color={theme.ac} />}
              label="Import from Phone Contacts"
              onPress={importContacts}
            />
            <DataRow
              icon={<DownloadIcon size={16} color={theme.info} />}
              label="Export All as .vcf"
              onPress={exportAll}
            />
            <DataRow
              icon={<UploadIcon size={16} color={theme.purp} />}
              label="Backup as JSON"
              onPress={backupAll}
            />
            <DataRow
              icon={<ArchiveIcon size={16} color={theme.warn} />}
              label={'Archived (' + archivedContacts.length + ')'}
              onPress={() => toggleSection('archived')}
            />
          </View>
        </SettingsSection>

        {/* Archived list (inline) */}
        {archivedContacts.length > 0 && (
          <SettingsSection
            icon={<ArchiveIcon size={18} color={theme.warn} />}
            title="Archived"
            subtitle={archivedContacts.length + ' contacts'}
            open={openSection === 'archived'}
            onPress={() => toggleSection('archived')}
          >
            <View style={{ padding: 14, gap: 6 }}>
              {archivedContacts.map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: theme.bg3,
                  }}
                >
                  <Avatar contact={c} size={32} />
                  <TouchableOpacity onPress={() => onPickContact(c)} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500' }}>
                      {c.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.t5 }}>
                      {c.company}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onUnarchive(c)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: theme.bgAc,
                      borderWidth: 1,
                      borderColor: theme.brdAc,
                    }}
                  >
                    <Text style={{ color: theme.ac, fontSize: 10, fontWeight: '700' }}>
                      Restore
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </SettingsSection>
        )}

        {/* About */}
        <SettingsSection
          icon={<RefreshIcon size={18} color={theme.t4} />}
          title="About"
          subtitle="App info and tutorial"
          open={openSection === 'about'}
          onPress={() => toggleSection('about')}
        >
          <View style={{ padding: 14, gap: 10 }}>
            <DataRow
              icon={<RefreshIcon size={16} color={theme.ac} />}
              label="Replay Walkthrough"
              onPress={onReplayWalkthrough}
            />
            <Text style={{ color: theme.t6, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              Radius v1.0
            </Text>
          </View>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

// =================== Granola Integration ===================
//
// Stage 1: manual-trigger sync with API key stored locally in AsyncStorage.
// User pastes their Granola Personal API key, hits Test, then Sync Now to
// pull recent notes and append them to matching contacts' convLog.

function GranolaIntegration({
  myCard,
  contacts,
  onCommit,
  showToast,
  reviewQueue,
  onAddToReviewQueue,
  onClearReviewQueue,
  onOpenReviewQueue,
}) {
  const { theme } = useTheme();

  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState(null); // null = unknown, '' = none, 'gk_...' = present
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');

  // Load stored key + last sync on mount
  useEffect(() => {
    (async () => {
      try {
        const k = await AsyncStorage.getItem(GRANOLA_KEY_STORAGE);
        const ls = await AsyncStorage.getItem(GRANOLA_LAST_SYNC_STORAGE);
        setStoredKey(k || '');
        setLastSync(ls || null);
      } catch (_) {
        setStoredKey('');
      }
    })();
  }, []);

  const isConnected = !!storedKey;

  async function testAndSave() {
    const key = apiKey.trim();
    if (!key) {
      Alert.alert('Missing key', 'Paste your Granola API key first.');
      return;
    }
    setTesting(true);
    setSyncStatus('');
    try {
      const result = await granolaTestKey(key);
      if (!result.ok) {
        Alert.alert('Connection failed', result.error || 'Could not verify the key.');
        setTesting(false);
        return;
      }
      await AsyncStorage.setItem(GRANOLA_KEY_STORAGE, key);
      setStoredKey(key);
      setApiKey('');
      showToast && showToast('Granola connected', theme.ac);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not connect.');
    }
    setTesting(false);
  }

  async function disconnect() {
    Alert.alert(
      'Disconnect Granola',
      'This removes your API key from this device and clears any pending review items. Your existing meeting log entries will stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(GRANOLA_KEY_STORAGE);
            await AsyncStorage.removeItem(GRANOLA_LAST_SYNC_STORAGE);
            await AsyncStorage.removeItem(GRANOLA_PROCESSED_IDS_STORAGE);
            if (onClearReviewQueue) {
              await onClearReviewQueue();
            }
            setStoredKey('');
            setLastSync(null);
            setSyncStatus('');
            showToast && showToast('Granola disconnected');
          },
        },
      ],
    );
  }

  async function syncNow() {
    if (!storedKey) return;
    setSyncing(true);
    setSyncStatus('Fetching recent meetings...');

    try {
      const result = await runGranolaSync({
        apiKey: storedKey,
        contacts,
        myCard,
        onProgress: (msg) => setSyncStatus(msg),
        onCommit,
        addToReviewQueue: onAddToReviewQueue,
      });

      // Reflect the new last-sync timestamp in the UI
      const now = new Date().toISOString();
      setLastSync(now);

      setSyncStatus(result.summary);
      showToast && showToast(`Granola sync: ${result.summary}`, theme.ac);
    } catch (e) {
      console.error('Granola sync error:', e);
      setSyncStatus('Sync failed: ' + (e.message || 'Unknown error'));
      Alert.alert('Sync failed', e.message || 'Unknown error');
    }

    setSyncing(false);
  }

  function maskKey(k) {
    if (!k) return '';
    if (k.length < 12) return '••••';
    return k.slice(0, 6) + '••••••••' + k.slice(-4);
  }

  // ---- Loading state ----
  if (storedKey === null) {
    return (
      <View style={{ padding: 14 }}>
        <ActivityIndicator color={theme.ac} size="small" />
      </View>
    );
  }

  // ---- Connected state ----
  if (isConnected) {
    return (
      <View style={{ padding: 14, gap: 12 }}>
        <View
          style={{
            backgroundColor: theme.bg3,
            borderRadius: 12,
            padding: 12,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#5BC97A',
              }}
            />
            <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '600' }}>
              Granola connected
            </Text>
          </View>
          <Text style={{ color: theme.t5, fontSize: 11, fontFamily: 'monospace' }}>
            {maskKey(storedKey)}
          </Text>
          {lastSync ? (
            <Text style={{ color: theme.t5, fontSize: 11 }}>
              Last sync: {new Date(lastSync).toLocaleString()}
            </Text>
          ) : (
            <Text style={{ color: theme.t5, fontSize: 11 }}>Not synced yet</Text>
          )}
        </View>

        <TouchableOpacity
          onPress={syncNow}
          disabled={syncing}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: theme.ac,
            alignItems: 'center',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                Syncing...
              </Text>
            </View>
          ) : (
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
              Sync Now
            </Text>
          )}
        </TouchableOpacity>

        {syncStatus ? (
          <Text style={{ color: theme.t4, fontSize: 11, lineHeight: 16 }}>
            {syncStatus}
          </Text>
        ) : null}

        {/* Review queue access row (only shown when there are items) */}
        {Array.isArray(reviewQueue) && reviewQueue.length > 0 ? (
          <TouchableOpacity
            onPress={() => onOpenReviewQueue && onOpenReviewQueue()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.warn + '50',
              backgroundColor: theme.warn + '15',
            }}
          >
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 8,
                backgroundColor: theme.warn,
                minWidth: 22,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {reviewQueue.length}
              </Text>
            </View>
            <Text style={{ flex: 1, color: theme.t1, fontSize: 13, fontWeight: '600' }}>
              {reviewQueue.length === 1 ? 'Item to review' : 'Items to review'}
            </Text>
            <ChevronRight size={14} color={theme.t5} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={disconnect}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.brdRed,
            backgroundColor: theme.bgRed,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.red, fontSize: 12, fontWeight: '600' }}>
            Disconnect
          </Text>
        </TouchableOpacity>

        <Text style={{ color: theme.t6, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
          Sync pulls meetings from the last 30 days on first run, then incrementally.
          Email-matched attendees are saved automatically. Name-only matches and unknown
          attendees go to the review queue for you to confirm.
        </Text>
      </View>
    );
  }

  // ---- Disconnected state ----
  return (
    <View style={{ padding: 14, gap: 10 }}>
      <Text style={{ color: theme.t4, fontSize: 12, lineHeight: 17 }}>
        Connect Granola to automatically pull meeting notes into your contacts' logs.
        Requires a Granola Business plan.
      </Text>
      <Text style={{ color: theme.t5, fontSize: 11 }}>
        Get a key from Granola: Settings → API → Create new key → Personal API key.
      </Text>
      <StyledInput
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="Paste your Granola API key"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        onPress={testAndSave}
        disabled={testing || !apiKey.trim()}
        style={{
          paddingVertical: 11,
          borderRadius: 12,
          backgroundColor: theme.ac,
          alignItems: 'center',
          opacity: testing || !apiKey.trim() ? 0.5 : 1,
        }}
      >
        {testing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
              Testing...
            </Text>
          </View>
        ) : (
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            Connect
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function SettingsSection({ icon, title, subtitle, open, onPress, children }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
        }}
      >
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>{title}</Text>
          <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={16} color={theme.t5} />
        </View>
      </TouchableOpacity>
      {open && <View style={{ borderTopWidth: 1, borderTopColor: theme.brd }}>{children}</View>}
    </View>
  );
}

function DataRow({ icon, label, onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        backgroundColor: theme.bg3,
      }}
    >
      {icon}
      <Text style={{ color: theme.t2, fontSize: 13, flex: 1 }}>{label}</Text>
      <ChevronRight size={14} color={theme.t5} />
    </TouchableOpacity>
  );
}

// =================== Tags Manager ===================

function TagsManager({ customTags, hiddenTags, onSaveCustom, onSaveHidden }) {
  const { theme } = useTheme();
  const [openCat, setOpenCat] = useState(null);
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');

  const allMasterLabels = MASTER_TAGS.map((t) => t.label);
  const commonGroup = {
    key: 'common',
    label: 'Common Tags',
    tags: COMMON_TAG_LABELS.filter((l) => allMasterLabels.includes(l)),
  };
  const masterGroups = SUBCATEGORIES.map((sc) => ({
    key: sc.key,
    label: sc.label,
    tags: MASTER_TAGS.filter((t) => t.subcategory === sc.key).map((t) => t.label),
  })).filter((g) => g.tags.length > 0);

  const sections = [commonGroup, ...masterGroups];

  function toggleCat(k) {
    setOpenCat(openCat === k ? null : k);
  }

  function toggleHide(label) {
    if (hiddenTags.includes(label)) {
      onSaveHidden(hiddenTags.filter((x) => x !== label));
    } else {
      onSaveHidden([...hiddenTags, label]);
    }
  }

  function bulkSet(sectionTags, hide) {
    if (hide) {
      const toAdd = sectionTags.filter((t) => !hiddenTags.includes(t));
      onSaveHidden([...hiddenTags, ...toAdd]);
    } else {
      const next = hiddenTags.filter((t) => !sectionTags.includes(t));
      onSaveHidden(next);
    }
  }

  function addCustom() {
    const trimmed = val.trim();
    if (!trimmed) return;
    const allLabels = [...allMasterLabels, ...customTags];
    if (allLabels.includes(trimmed)) {
      Alert.alert('Already exists', `"${trimmed}" is already in your tag list.`);
      return;
    }
    onSaveCustom([...customTags, trimmed]);
    setVal('');
    setAdding(false);
  }

  function deleteCustom(label) {
    Alert.alert('Delete tag', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onSaveCustom(customTags.filter((x) => x !== label)),
      },
    ]);
  }

  return (
    <View style={{ padding: 14 }}>
      <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 12, lineHeight: 16 }}>
        Tap a tag to hide or show it. Hidden tags stay on existing contacts but won't appear
        in the picker.
      </Text>

      {sections.map((group) => {
        const open = openCat === group.key;
        const hiddenInGroup = group.tags.filter((t) => hiddenTags.includes(t)).length;
        const allHidden = hiddenInGroup === group.tags.length && group.tags.length > 0;
        const visibleCount = group.tags.length - hiddenInGroup;
        return (
          <CategoryBlock
            key={group.key}
            theme={theme}
            label={group.label}
            count={group.tags.length}
            visibleCount={visibleCount}
            open={open}
            onToggleOpen={() => toggleCat(group.key)}
            onBulkSet={() => bulkSet(group.tags, !allHidden)}
            allHidden={allHidden}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {group.tags.map((label) => (
                <TagChip
                  key={`${group.key}-${label}`}
                  label={label}
                  hidden={hiddenTags.includes(label)}
                  onPress={() => toggleHide(label)}
                />
              ))}
            </View>
          </CategoryBlock>
        );
      })}

      <CategoryBlock
        theme={theme}
        label="Your Custom Tags"
        count={customTags.length}
        visibleCount={customTags.filter((t) => !hiddenTags.includes(t)).length}
        open={openCat === 'custom'}
        onToggleOpen={() => toggleCat('custom')}
        onBulkSet={
          customTags.length > 0
            ? () => {
                const allHidden =
                  customTags.every((t) => hiddenTags.includes(t)) && customTags.length > 0;
                bulkSet(customTags, !allHidden);
              }
            : null
        }
        allHidden={
          customTags.length > 0 && customTags.every((t) => hiddenTags.includes(t))
        }
      >
        {customTags.length === 0 && (
          <Text style={{ fontSize: 12, color: theme.t6, marginBottom: 8 }}>
            None yet. Add your own below.
          </Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {customTags.map((label) => (
            <TagChip
              key={`custom-${label}`}
              label={label}
              hidden={hiddenTags.includes(label)}
              onPress={() => toggleHide(label)}
              onDelete={() => deleteCustom(label)}
            />
          ))}
        </View>
        {adding ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <StyledInput
              value={val}
              onChangeText={setVal}
              placeholder="New tag"
              style={{ flex: 1 }}
              autoFocus
              onSubmitEditing={addCustom}
            />
            <TouchableOpacity
              onPress={addCustom}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: theme.ac,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setAdding(false);
                setVal('');
              }}
              style={{ padding: 10 }}
            >
              <XIcon size={18} color={theme.t4} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.brd2,
              alignSelf: 'flex-start',
              marginTop: 10,
            }}
          >
            <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '500' }}>
              + Add Custom Tag
            </Text>
          </TouchableOpacity>
        )}
      </CategoryBlock>
    </View>
  );
}

function CategoryBlock({
  theme,
  label,
  count,
  visibleCount,
  open,
  onToggleOpen,
  onBulkSet,
  allHidden,
  children,
}) {
  return (
    <View
      style={{
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brd,
        backgroundColor: theme.bg3,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 12,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={onToggleOpen}
          activeOpacity={0.7}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <ChevronDown size={14} color={theme.t5} />
          </View>
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            {label}
          </Text>
          <Text style={{ fontSize: 11, color: theme.t5 }}>
            {count > 0 ? `${visibleCount}/${count}` : '0'}
          </Text>
        </TouchableOpacity>

        {onBulkSet && count > 0 && (
          <TouchableOpacity
            onPress={onBulkSet}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd2,
            }}
          >
            <Text style={{ fontSize: 10, color: theme.t4, fontWeight: '600' }}>
              {allHidden ? 'Show all' : 'Hide all'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {open && (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: theme.brd,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

function TagChip({ label, hidden, onPress, onDelete }) {
  const { theme } = useTheme();
  const c = getTagColor(label);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 20,
          borderWidth: 1,
          backgroundColor: hidden ? theme.bg3 : c + '18',
          borderColor: hidden ? theme.brd : c + '50',
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: c,
            opacity: hidden ? 0.3 : 1,
          }}
        />
        <Text
          style={{
            fontSize: 12,
            color: hidden ? theme.t6 : c,
            fontWeight: '600',
            textDecorationLine: hidden ? 'line-through' : 'none',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <TrashIcon size={12} color={theme.red} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// =================== Interests Manager ===================

function InterestsManager({ customInterests, hiddenInterests, onSaveCustom, onSaveHidden }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const all = [...DEFAULT_INTERESTS, ...customInterests];

  function add() {
    if (!val.trim() || all.includes(val.trim())) return;
    onSaveCustom([...customInterests, val.trim()]);
    setVal('');
    setAdding(false);
  }

  function toggleHide(t) {
    if (hiddenInterests.includes(t)) onSaveHidden(hiddenInterests.filter((x) => x !== t));
    else onSaveHidden([...hiddenInterests, t]);
  }

  function deleteOne(t) {
    Alert.alert('Delete interest', 'Delete "' + t + '"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onSaveCustom(customInterests.filter((x) => x !== t)),
      },
    ]);
  }

  return (
    <View style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {all.map((t) => {
          const hidden = hiddenInterests.includes(t);
          const isCustom = customInterests.includes(t);
          return (
            <TouchableOpacity
              key={t}
              onPress={() => toggleHide(t)}
              onLongPress={() => isCustom && deleteOne(t)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor: hidden ? theme.bg3 : '#7B5EEA18',
                borderColor: hidden ? theme.brd : theme.purp + '40',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: hidden ? theme.t6 : theme.purp,
                  fontWeight: '500',
                  textDecorationLine: hidden ? 'line-through' : 'none',
                }}
              >
                {t}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {adding ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <StyledInput
            value={val}
            onChangeText={setVal}
            placeholder="New interest"
            style={{ flex: 1 }}
            autoFocus
            onSubmitEditing={add}
          />
          <TouchableOpacity
            onPress={add}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: theme.ac,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setAdding(true)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.brd2,
            alignSelf: 'flex-start',
            marginTop: 10,
          }}
        >
          <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '500' }}>+ Add Interest</Text>
        </TouchableOpacity>
      )}
      <Text style={{ color: theme.t6, fontSize: 10, marginTop: 8 }}>
        Tap to hide / show. Long-press custom interests to delete.
      </Text>
    </View>
  );
}