import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
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
  MailIcon,
  XIcon,
  SearchIcon,
} from '../components/Icons';
import { Avatar, Toggle, StyledInput } from '../components/Common';
import { getTagColor, makeVcf } from '../utils/helpers';
import { DEFAULT_TAGS, DEFAULT_INTERESTS } from '../constants';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';

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
  onReplayWalkthrough,
  showToast,
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
          {openSection === 'archived' || openSection === 'data' ? null : null}
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

function TagsManager({ customTags, hiddenTags, onSaveCustom, onSaveHidden }) {
  const { theme } = useTheme();
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const all = [...DEFAULT_TAGS, ...customTags];

  function add() {
    if (!val.trim() || all.includes(val.trim())) return;
    onSaveCustom([...customTags, val.trim()]);
    setVal('');
    setAdding(false);
  }

  function toggleHide(t) {
    if (hiddenTags.includes(t)) onSaveHidden(hiddenTags.filter((x) => x !== t));
    else onSaveHidden([...hiddenTags, t]);
  }

  function deleteTag(t) {
    Alert.alert('Delete tag', 'Delete "' + t + '"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onSaveCustom(customTags.filter((x) => x !== t)),
      },
    ]);
  }

  return (
    <View style={{ padding: 14 }}>
      {all.map((t) => {
        const c = getTagColor(t);
        const hidden = hiddenTags.includes(t);
        const isCustom = customTags.includes(t);
        return (
          <View
            key={t}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 8,
              marginBottom: 6,
              borderRadius: 10,
              backgroundColor: hidden ? theme.bg3 : theme.bg5,
              borderWidth: 1,
              borderColor: hidden ? theme.brd : c + '40',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: c,
                opacity: hidden ? 0.3 : 1,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: hidden ? theme.t6 : c,
                fontWeight: '600',
                textDecorationLine: hidden ? 'line-through' : 'none',
              }}
            >
              {t}
            </Text>
            <TouchableOpacity
              onPress={() => toggleHide(t)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd2,
              }}
            >
              <Text style={{ fontSize: 10, color: theme.t4, fontWeight: '600' }}>
                {hidden ? 'Show' : 'Hide'}
              </Text>
            </TouchableOpacity>
            {isCustom && (
              <TouchableOpacity onPress={() => deleteTag(t)} style={{ padding: 4 }}>
                <TrashIcon size={14} color={theme.red} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {adding ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <StyledInput
            value={val}
            onChangeText={setVal}
            placeholder="New tag"
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
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.brd2,
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text style={{ color: theme.t4, fontSize: 12, fontWeight: '500' }}>+ Add Tag</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
