import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
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
import { getTagColor, makeVcf } from '../utils/helpers';
import { DEFAULT_INTERESTS } from '../constants';
import {
  TAGS as MASTER_TAGS,
  SUBCATEGORIES,
  COMMON_TAG_LABELS,
} from '../constants/tagLibrary';
import { testKey as granolaTestKey } from '../utils/granola';
import { runGranolaSync, reprocessSelfOnlyItems } from '../utils/granolaSync';
import { createPortalSession } from '../lib/stripeApi';
import { supabase } from '../lib/supabase';
import { clearStaleSession } from '../lib/auth';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../constants/legal';
import { SUMMARY_LENGTH_OPTIONS, DEFAULT_SUMMARY_LENGTH } from '../utils/ai';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const GRANOLA_KEY_STORAGE = 'crm-granola-key';
const GRANOLA_LAST_SYNC_STORAGE = 'crm-granola-last-sync';
const GRANOLA_PROCESSED_IDS_STORAGE = 'crm-granola-processed-ids';

function confirmAction(title, message, onConfirm, confirmLabel = 'OK') {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(message || title)) onConfirm();
    } else {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

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
  onDeleteAllContacts,
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
  granolaAiUnlocked,
  tier,
  effectiveTier,
  trialActive,
  trialDaysLeft,
  aiCallsCount,
  aiRemaining,
  hasStripeCustomer,
  onShowPaywall,
  onSignOut,
  meetingSummaryLength,
  onSaveMeetingSummaryLength,
  // Notification preferences. Booleans live on the user's profile row.
  notificationsEnabled,
  notifOverdue,
  notifBirthdays,
  hasPushToken,
  onSaveNotificationPrefs,
  onRegisterPushToken,
  onImportContactsPress,
}) {
  const { theme, themeName, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [openSection, setOpenSection] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  function toggleSection(s) {
    setOpenSection(openSection === s ? null : s);
  }

  async function openBillingPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
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
    setPortalLoading(false);
  }

  // Import from phone contacts is handled by the dedicated picker screen
  // (AddScreen 'import' mode), reached via onImportContactsPress. We no
  // longer bulk-import the entire address book from here.

  async function exportAll() {
    try {
      const allVcf = contacts.filter((c) => !c.archived).map(makeVcf).join('\r\n');
      const path = FileSystem.cacheDirectory + 'veery_contacts.vcf';
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
      const path = FileSystem.cacheDirectory + 'veery_backup.json';
      await FileSystem.writeAsStringAsync(path, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' });
      }
    } catch (e) {
      Alert.alert('Backup failed', e.message);
    }
  }

  function handleDeleteAllContacts() {
    confirmAction(
      'Delete all contacts',
      'This permanently deletes every contact you have. Your sample contacts and account stay. This cannot be undone.',
      async () => {
        await onDeleteAllContacts();
        showToast && showToast('All contacts deleted', theme.red);
      },
      'Delete all',
    );
  }

  function handleResetApp() {
    confirmAction(
      'Reset app',
      'This clears all local app data: contacts, tags, interests, mailing lists, and integration keys. Your account and any synced data on the server stay. You will be returned to the walkthrough.',
      async () => {
        try {
          await AsyncStorage.clear();
          onCommit([]);
          showToast && showToast('App reset. Reload to continue.', theme.warn);
        } catch (e) {
          Alert.alert('Reset failed', e.message || 'Try again.');
        }
      },
      'Reset app',
    );
  }

  function handleSignOut() {
    confirmAction(
      'Sign out',
      'You will be signed out of this device. Your data stays safe on the server.',
      () => {
        if (onSignOut) {
          onSignOut();
        } else {
          Alert.alert(
            'Sign out unavailable',
            'No sign-out handler is wired up yet. Pass an onSignOut prop to SettingsScreen.',
          );
        }
      },
      'Sign out',
    );
  }

  function handleDeleteAccount() {
    confirmAction(
      'Delete account',
      'This permanently deletes your account, all of your contacts, and every other piece of data tied to it. This cannot be undone.',
      () => {
        confirmAction(
          'Are you absolutely sure?',
          'Tap "Delete forever" to wipe your account and all data. There is no recovery.',
          async () => {
            try {
              const { data, error } = await supabase.functions.invoke('delete-account', {
                body: {},
              });
              if (error) throw new Error(error.message || 'Delete failed');
              if (data?.error) throw new Error(data.error);
              // Function already revoked refresh tokens server-side; clear the
              // local session so onAuthStateChange routes to AuthScreen.
              await clearStaleSession();
            } catch (e) {
              Alert.alert(
                'Delete failed',
                e.message || 'Something went wrong. Try again or contact support.',
              );
            }
          },
          'Delete forever',
        );
      },
      'Continue',
    );
  }

  const listsCount = Array.isArray(mailingLists) ? mailingLists.length : 0;

  const currentSummaryLength =
    meetingSummaryLength && SUMMARY_LENGTH_OPTIONS[meetingSummaryLength]
      ? meetingSummaryLength
      : DEFAULT_SUMMARY_LENGTH;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 20,
          backgroundColor: theme.navBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.brd,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 4,
            fontFamily: theme.fontDisplay,
          }}
        >
          Settings
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5 }}>
          Customize your experience here
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 120,
        }}
      >

        <SectionLabel theme={theme} text="Account" />

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

        <SubscriptionCard
          theme={theme}
          tier={effectiveTier}
          trialActive={trialActive}
          trialDaysLeft={trialDaysLeft}
          aiCallsCount={aiCallsCount}
          aiRemaining={aiRemaining}
          hasStripeCustomer={hasStripeCustomer}
          portalLoading={portalLoading}
          onUpgrade={() => onShowPaywall && onShowPaywall('upgrade')}
          onManage={openBillingPortal}
        />

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
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>
              Account & Security
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              PIN, password, sign-in
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <SectionLabel theme={theme} text="Preferences" />

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
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>Theme</Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              {themeName === 'dark' ? 'Dark' : 'Light'}
            </Text>
          </View>
          <Toggle value={themeName === 'dark'} onValueChange={toggleTheme} color={theme.purp} />
        </View>

        {/* Notifications: collapsible section with global on/off and per-type toggles */}
        <SettingsSection
          icon={<RefreshIcon size={18} color={theme.info} />}
          title="Notifications"
          subtitle={
            notificationsEnabled
              ? buildNotifSubtitle(notifOverdue, notifBirthdays)
              : 'Off'
          }
          open={openSection === 'notifications'}
          onPress={() => toggleSection('notifications')}
        >
          <NotificationsBody
            theme={theme}
            notificationsEnabled={notificationsEnabled}
            notifOverdue={notifOverdue}
            notifBirthdays={notifBirthdays}
            hasPushToken={hasPushToken}
            onSaveNotificationPrefs={onSaveNotificationPrefs}
            onRegisterPushToken={onRegisterPushToken}
            showToast={showToast}
          />
        </SettingsSection>

        <SectionLabel theme={theme} text="AI" />

        <SettingsSection
          icon={<ChatIcon size={18} color={theme.purp} />}
          title="Meeting Summary Length"
          subtitle={SUMMARY_LENGTH_OPTIONS[currentSummaryLength].label}
          open={openSection === 'ai_summary_length'}
          onPress={() => toggleSection('ai_summary_length')}
        >
          <View style={{ padding: 14, gap: 8 }}>
            <Text style={{ fontSize: 11, color: theme.t5, lineHeight: 16, marginBottom: 4 }}>
              How AI summarizes meeting transcripts when you import notes or process Granola
              meetings. Applies to future summaries, not existing ones.
            </Text>
            {Object.values(SUMMARY_LENGTH_OPTIONS).map((opt) => {
              const selected = opt.key === currentSummaryLength;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => onSaveMeetingSummaryLength && onSaveMeetingSummaryLength(opt.key)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: selected ? theme.purp + '15' : theme.bg3,
                    borderColor: selected ? theme.purp + '60' : theme.brd,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: selected ? theme.purp : theme.brd2,
                      backgroundColor: selected ? theme.purp : 'transparent',
                      marginTop: 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected ? (
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#fff',
                        }}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: selected ? theme.purp : theme.t1,
                        marginBottom: 2,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.t5, lineHeight: 15 }}>
                      {opt.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsSection>

        <SectionLabel theme={theme} text="Organization" />

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

        <SectionLabel theme={theme} text="Integrations" />

        <SettingsSection
          icon={<ChatIcon size={18} color={theme.ac} />}
          title="Granola"
          subtitle="Pull meeting notes into contact logs"
          open={openSection === 'granola'}
          onPress={() => toggleSection('granola')}
        >
          <GranolaIntegration
            myCard={myCard}
            contacts={contacts}
            onCommit={onCommit}
            showToast={showToast}
            reviewQueue={reviewQueue}
            onAddToReviewQueue={onAddToReviewQueue}
            onRemoveFromReviewQueue={onRemoveFromReviewQueue}
            onClearReviewQueue={onClearReviewQueue}
            onOpenReviewQueue={onOpenReviewQueue}
            granolaAiUnlocked={granolaAiUnlocked}
          />
        </SettingsSection>

        <ComingSoonRow
          theme={theme}
          icon={<RefreshIcon size={18} color={theme.t5} />}
          title="Calendar"
          subtitle="Sync with Google or iCloud"
        />

        <ComingSoonRow
          theme={theme}
          icon={<UsersIcon size={18} color={theme.t5} />}
          title="Business Card Scanner"
          subtitle="Snap a card, get a contact (Pro)"
        />

        <SectionLabel theme={theme} text="Data" />

        <SettingsSection
          icon={<DownloadIcon size={18} color={theme.ac} />}
          title="Import & Export"
          subtitle="Phone contacts, vCard, JSON backup"
          open={openSection === 'data'}
          onPress={() => toggleSection('data')}
        >
          <View style={{ padding: 14, gap: 8 }}>
            <DataRow
              icon={<UsersIcon size={16} color={theme.ac} />}
              label="Import from Phone Contacts"
              onPress={onImportContactsPress}
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
          </View>
        </SettingsSection>

        <SettingsSection
          icon={<ArchiveIcon size={18} color={theme.warn} />}
          title="Archived"
          subtitle={
            archivedContacts.length === 0
              ? 'No archived contacts'
              : `${archivedContacts.length} ${archivedContacts.length === 1 ? 'contact' : 'contacts'}`
          }
          open={openSection === 'archived'}
          onPress={() => toggleSection('archived')}
        >
          <View style={{ padding: 14, gap: 6 }}>
            {archivedContacts.length === 0 ? (
              <Text style={{ color: theme.t5, fontSize: 12, textAlign: 'center', padding: 8 }}>
                Archived contacts will show up here.
              </Text>
            ) : (
              archivedContacts.map((c) => (
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
                    <Text style={{ fontSize: 11, color: theme.t5 }}>{c.company}</Text>
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
              ))
            )}
          </View>
        </SettingsSection>

        <SectionLabel theme={theme} text="Help & About" />

        <TouchableOpacity
          onPress={onReplayWalkthrough}
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
          <RefreshIcon size={18} color={theme.ac} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>
              Replay Walkthrough
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              See the intro tour again
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:veeryapp@gmail.com?subject=Veery feedback')}
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
              Send Feedback
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              Bug reports, feature requests, ideas
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
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
          <LockIcon size={18} color={theme.t4} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>
              Privacy Policy
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
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
          <CardIcon size={18} color={theme.t4} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>
              Terms of Service
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.t6, fontSize: 11 }}>Veery v1.0</Text>
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 14,
            padding: 14,
            marginTop: 18,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <LockIcon size={18} color={theme.t4} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '500' }}>Sign out</Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              Sign out of this device
            </Text>
          </View>
          <ChevronRight size={16} color={theme.t5} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeleteAllContacts}
          style={{
            backgroundColor: theme.bgRed,
            borderWidth: 1,
            borderColor: theme.brdRed,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <TrashIcon size={18} color={theme.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.red, fontSize: 14, fontWeight: '600' }}>
              Delete all contacts
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              Removes every real contact. Cannot be undone.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResetApp}
          style={{
            backgroundColor: theme.bgRed,
            borderWidth: 1,
            borderColor: theme.brdRed,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <RefreshIcon size={18} color={theme.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.red, fontSize: 14, fontWeight: '600' }}>
              Reset app
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              Clears all local data. Account stays.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{
            backgroundColor: theme.bgRed,
            borderWidth: 1,
            borderColor: theme.brdRed,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <TrashIcon size={18} color={theme.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.red, fontSize: 14, fontWeight: '600' }}>
              Delete account
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              Deletes account and purges all user data. Cannot be undone.
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// Build the subtitle that shows under the Notifications header.
// "All on", "Off", or "Only Overdue", "Only Birthdays" when partial.
function buildNotifSubtitle(notifOverdue, notifBirthdays) {
  if (notifOverdue && notifBirthdays) return 'All types on';
  if (notifOverdue && !notifBirthdays) return 'Overdue only';
  if (!notifOverdue && notifBirthdays) return 'Birthdays only';
  return 'No types enabled';
}

// ============================================================
// Notifications body
// ============================================================
//
// Top row: global on/off switch. When the user flips it on for the first
// time we trigger the permission request via onRegisterPushToken. If the
// permission flow fails or the user denies, we flip the switch back off
// and show a helpful message.
//
// Below the global switch: two per-type toggles (Overdue, Birthdays).
// When global is off, the per-type rows are visually greyed and ignore
// taps so the user understands they're inactive.
function NotificationsBody({
  theme,
  notificationsEnabled,
  notifOverdue,
  notifBirthdays,
  hasPushToken,
  onSaveNotificationPrefs,
  onRegisterPushToken,
  showToast,
}) {
  const [registering, setRegistering] = useState(false);

  async function handleGlobalToggle(newValue) {
    if (newValue) {
      // Turning on. If we don't yet have a push token saved, run the
      // permission/registration flow before saving the preference.
      if (!hasPushToken) {
        setRegistering(true);
        const result = await (onRegisterPushToken
          ? onRegisterPushToken()
          : { status: 'error' });
        setRegistering(false);
        if (result.status !== 'ok') {
          if (result.status === 'denied') {
            Alert.alert(
              'Notifications blocked',
              'You denied permission. Open your device Settings to enable notifications for Veery.',
              [
                { text: 'OK', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
          } else if (result.status === 'unsupported') {
            Alert.alert(
              'Not supported on this device',
              'Push notifications require a physical device. They will work once you install the app on iOS or Android.',
            );
          } else {
            Alert.alert(
              'Could not enable notifications',
              'Something went wrong getting your device token. Try again in a minute.',
            );
          }
          return;
        }
      }
      await onSaveNotificationPrefs({ notifications_enabled: true });
    } else {
      await onSaveNotificationPrefs({ notifications_enabled: false });
    }
  }

  function handleTypeToggle(key, newValue) {
    if (!notificationsEnabled) return;
    onSaveNotificationPrefs({ [key]: newValue });
  }

  return (
    <View style={{ padding: 14, gap: 8 }}>
      <Text style={{ fontSize: 11, color: theme.t5, lineHeight: 16, marginBottom: 4 }}>
        Get gentle reminders so you don't forget the people you care about. We never share
        your data with anyone.
      </Text>

      {/* Global toggle */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderRadius: 12,
          backgroundColor: theme.bg3,
          borderWidth: 1,
          borderColor: theme.brd,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '600' }}>
            Enable notifications
          </Text>
          <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
            {registering
              ? 'Requesting permission...'
              : notificationsEnabled
                ? 'Push notifications are active'
                : 'Master switch for all reminders'}
          </Text>
        </View>
        {registering ? (
          <ActivityIndicator color={theme.ac} size="small" />
        ) : (
          <Toggle
            value={!!notificationsEnabled}
            onValueChange={handleGlobalToggle}
            color={theme.ac}
          />
        )}
      </View>

      {/* Section header for per-type toggles */}
      <Text
        style={{
          fontSize: 10,
          color: theme.t5,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginTop: 8,
          marginBottom: 2,
          marginLeft: 4,
        }}
      >
        What to notify me about
      </Text>

      <NotifTypeRow
        theme={theme}
        enabled={notificationsEnabled}
        value={notifOverdue}
        onValueChange={(v) => handleTypeToggle('notif_overdue', v)}
        title="Overdue follow-ups"
        subtitle="When a contact's follow-up date passes"
      />

      <NotifTypeRow
        theme={theme}
        enabled={notificationsEnabled}
        value={notifBirthdays}
        onValueChange={(v) => handleTypeToggle('notif_birthdays', v)}
        title="Birthdays & anniversaries"
        subtitle="On the day, in the morning"
      />

      {/* Helper text when the user denies permission at the OS level */}
      {notificationsEnabled && !hasPushToken ? (
        <View
          style={{
            marginTop: 4,
            padding: 10,
            backgroundColor: theme.warn + '12',
            borderWidth: 1,
            borderColor: theme.warn + '40',
            borderRadius: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: theme.warn, lineHeight: 16 }}>
            Heads up: we don't have a push token for this device. Notifications won't
            actually deliver until you reinstall on a real device with permissions granted.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function NotifTypeRow({ theme, enabled, value, onValueChange, title, subtitle }) {
  // When the parent global toggle is off, fade the row and ignore taps.
  // The toggle still reflects the stored preference, just isn't interactive.
  const opacity = enabled ? 1 : 0.4;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: theme.bg3,
        borderWidth: 1,
        borderColor: theme.brd,
        gap: 12,
        opacity,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Toggle
        value={!!value}
        onValueChange={onValueChange}
        color={theme.info}
        disabled={!enabled}
      />
    </View>
  );
}

function SectionLabel({ theme, text, danger }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: danger ? theme.red : theme.t5,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginTop: 18,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {text}
    </Text>
  );
}

function ComingSoonRow({ theme, icon, title, subtitle }) {
  return (
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
        opacity: 0.55,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.t2, fontSize: 14, fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: theme.bg3,
          borderWidth: 1,
          borderColor: theme.brd2,
        }}
      >
        <Text style={{ color: theme.t5, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
          SOON
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Granola Integration
// ============================================================
function GranolaIntegration({
  myCard,
  contacts,
  onCommit,
  showToast,
  reviewQueue,
  onAddToReviewQueue,
  onRemoveFromReviewQueue,
  onClearReviewQueue,
  onOpenReviewQueue,
  granolaAiUnlocked,
}) {
  const { theme } = useTheme();

  const [apiKey, setApiKey] = useState('');
  const [storedKey, setStoredKey] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState('');

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

  const selfOnlyCount = React.useMemo(() => {
    if (!Array.isArray(reviewQueue) || reviewQueue.length === 0) return 0;
    const myEmails = new Set();
    if (myCard?.email) myEmails.add(myCard.email.toLowerCase());
    if (Array.isArray(myCard?.emails)) {
      for (const e of myCard.emails) if (e?.value) myEmails.add(e.value.toLowerCase());
    }
    const myNames = new Set();
    if (myCard?.name) myNames.add(myCard.name.toLowerCase().trim());
    if (myCard?.displayName) myNames.add(myCard.displayName.toLowerCase().trim());

    return reviewQueue.filter((q) => {
      const email = (q?.attendee?.email || '').toLowerCase().trim();
      const name = (q?.attendee?.name || '').toLowerCase().trim();
      return (email && myEmails.has(email)) || (name && myNames.has(name));
    }).length;
  }, [reviewQueue, myCard]);

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
    confirmAction(
      'Disconnect Granola',
      'This removes your API key from this device and clears any pending review items. Your existing meeting log entries will stay.',
      async () => {
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
      'Disconnect',
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
        granolaAiUnlocked: !!granolaAiUnlocked,
      });

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

  async function findMissingAttendees() {
    if (!storedKey) return;
    if (!granolaAiUnlocked) return;
    if (selfOnlyCount === 0) return;

    confirmAction(
      'Find missing attendees',
      `This will use AI to re-read the transcripts of ${selfOnlyCount} meeting${selfOnlyCount === 1 ? '' : 's'} where only you were detected as an attendee. It will identify the other speakers and replace the self-attendee items with proper queue items.`,
      async () => {
        setReprocessing(true);
        setReprocessStatus('Starting...');
        try {
          const result = await reprocessSelfOnlyItems({
            apiKey: storedKey,
            myCard,
            contacts,
            granolaAiUnlocked: true,
            reviewQueue,
            onProgress: (msg) => setReprocessStatus(msg),
            onCommit,
            addToReviewQueue: onAddToReviewQueue,
            removeFromReviewQueue: onRemoveFromReviewQueue,
          });
          setReprocessStatus(result.summary || 'Done.');
          showToast && showToast(result.summary, theme.ac);
        } catch (e) {
          console.error('reprocessSelfOnlyItems error:', e);
          setReprocessStatus('Reprocess failed: ' + (e.message || 'Unknown error'));
          Alert.alert('Reprocess failed', e.message || 'Unknown error');
        }
        setReprocessing(false);
      },
      'Find them',
    );
  }

  function maskKey(k) {
    if (!k) return '';
    if (k.length < 12) return '••••';
    return k.slice(0, 6) + '••••••••' + k.slice(-4);
  }

  if (storedKey === null) {
    return (
      <View style={{ padding: 14 }}>
        <ActivityIndicator color={theme.ac} size="small" />
      </View>
    );
  }

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
          <Text style={{ color: theme.t4, fontSize: 11, lineHeight: 16 }}>{syncStatus}</Text>
        ) : null}

        {granolaAiUnlocked && selfOnlyCount > 0 ? (
          <View
            style={{
              backgroundColor: theme.purp + '10',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.purp + '40',
              gap: 8,
            }}
          >
            <Text style={{ color: theme.t1, fontSize: 12, fontWeight: '600' }}>
              Some meetings only show you as an attendee
            </Text>
            <Text style={{ color: theme.t4, fontSize: 11, lineHeight: 16 }}>
              {selfOnlyCount} item{selfOnlyCount === 1 ? '' : 's'} in your review queue
              {selfOnlyCount === 1 ? ' has' : ' have'} only you listed. This happens when
              Granola records from another device. AI can re-read the transcripts to find
              the other speakers.
            </Text>
            <TouchableOpacity
              onPress={findMissingAttendees}
              disabled={reprocessing}
              style={{
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: theme.purp,
                alignItems: 'center',
                opacity: reprocessing ? 0.6 : 1,
              }}
            >
              {reprocessing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    Working...
                  </Text>
                </View>
              ) : (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  Find missing attendees
                </Text>
              )}
            </TouchableOpacity>
            {reprocessStatus ? (
              <Text style={{ color: theme.t5, fontSize: 11, lineHeight: 15 }}>
                {reprocessStatus}
              </Text>
            ) : null}
          </View>
        ) : null}

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
          <Text style={{ color: theme.red, fontSize: 12, fontWeight: '600' }}>Disconnect</Text>
        </TouchableOpacity>

        <Text style={{ color: theme.t6, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
          Sync pulls meetings from the last 30 days on first run, then incrementally.
          Email-matched attendees are saved automatically. Name-only matches and unknown
          attendees go to the review queue for you to confirm.
        </Text>
      </View>
    );
  }

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
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Testing...</Text>
          </View>
        ) : (
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Connect</Text>
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
    confirmAction(
      'Delete tag',
      `Delete "${label}"?`,
      () => onSaveCustom(customTags.filter((x) => x !== label)),
      'Delete',
    );
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
        allHidden={customTags.length > 0 && customTags.every((t) => hiddenTags.includes(t))}
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
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>{label}</Text>
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
    confirmAction(
      'Delete interest',
      'Delete "' + t + '"?',
      () => onSaveCustom(customInterests.filter((x) => x !== t)),
      'Delete',
    );
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

function SubscriptionCard({
  theme,
  tier,
  trialActive,
  trialDaysLeft,
  aiCallsCount,
  aiRemaining,
  hasStripeCustomer,
  portalLoading,
  onUpgrade,
  onManage,
}) {
  const isPro = tier === 'pro' && !trialActive;
  const isTrial = tier === 'trial' || trialActive;
  const isFree = !isPro && !isTrial;

  let label = 'Free';
  let subline = '';
  if (isTrial) {
    label = 'Pro · trial';
    subline =
      trialDaysLeft != null
        ? trialDaysLeft + (trialDaysLeft === 1 ? ' day' : ' days') + ' remaining'
        : 'Trial active';
  } else if (isPro) {
    label = 'Pro';
    subline = 'Unlimited AI · all features unlocked';
  } else {
    const used = Number.isFinite(aiCallsCount) ? aiCallsCount : 0;
    const total =
      Number.isFinite(aiRemaining) && aiRemaining > 0 ? used + aiRemaining : 5;
    subline = used + ' of ' + total + ' AI calls used this month';
  }

  return (
    <View
      style={{
        backgroundColor: isFree ? theme.bg2 : theme.bgAc,
        borderWidth: 1,
        borderColor: isFree ? theme.brd : theme.brdAc,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              color: theme.t5,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Your plan
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isFree ? theme.t1 : theme.ac,
              marginBottom: 2,
              fontFamily: theme.fontDisplay,
            }}
          >
            {label}
          </Text>
          {subline ? <Text style={{ fontSize: 12, color: theme.t4 }}>{subline}</Text> : null}
        </View>
        {isFree ? (
          <TouchableOpacity
            onPress={onUpgrade}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: theme.ac,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Upgrade</Text>
          </TouchableOpacity>
        ) : hasStripeCustomer ? (
          <TouchableOpacity
            onPress={onManage}
            disabled={portalLoading}
            activeOpacity={0.8}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.ac,
              backgroundColor: 'transparent',
              opacity: portalLoading ? 0.5 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {portalLoading ? <ActivityIndicator color={theme.ac} size="small" /> : null}
            <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '700' }}>Manage</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}