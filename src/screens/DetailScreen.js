import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../styles/theme';
import { Avatar, StrengthDot, TagPill, BackButton } from '../components/Common';
import {
  CameraIcon,
  DownloadIcon,
  ArchiveIcon,
  ChatIcon,
  ChevronDown,
  XIcon,
  MailIcon,
} from '../components/Icons';
import ConvLog from '../components/ConvLog';
import {
  nextDate,
  daysUntil,
  daysSince,
  fmtDate,
  isoToday,
  makeVcf,
  formatDateObject,
  displayKidAge,
  dateObjectIsEmpty,
  DAYS_OF_WEEK,
} from '../utils/helpers';
import {
  FREQ,
  TEMPLATE_TYPES,
  getPrimaryPhone,
  getPrimaryEmail,
  getDisplayName,
  formatFlexibleDate,
} from '../constants';
import { aiMeetingPrep, aiBackground, aiTemplate, aiAnswerQuestion } from '../utils/ai';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

export default function DetailScreen({
  contact,
  onBack,
  onEdit,
  onUpdate,
  onArchive,
  onDelete,
  showToast,
  mailingLists,
  onToggleContactOnList,
  consumeAiCall,
  aiRemaining,
  effectiveTier,
  myCard,
  meetingSummaryLength,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!contact) return null;

  const displayName = getDisplayName(contact);

  const nd = nextDate(contact.lastContacted, contact.freq, contact.freqStartedAt, contact.freqDayOfWeek);
  const ndDiff = nd ? daysUntil(nd) : null;
  const fl = FREQ.find((o) => o.v === contact.freq);

  const phones = Array.isArray(contact.phones) && contact.phones.length > 0
    ? contact.phones
    : (contact.phone ? [{ label: 'Cell', value: contact.phone }] : []);
  const emails = Array.isArray(contact.emails) && contact.emails.length > 0
    ? contact.emails
    : (contact.email ? [{ label: 'Personal', value: contact.email }] : []);
  const addresses = Array.isArray(contact.addresses) ? contact.addresses : [];

  const primaryPhone = getPrimaryPhone(contact);
  const primaryEmail = getPrimaryEmail(contact);

  const hasBackground =
    !!contact.experience ||
    (Array.isArray(contact.pastCompanies) && contact.pastCompanies.length > 0);

  const hasPersonal =
    !!contact.hometown ||
    !!contact.married ||
    (Array.isArray(contact.kids) && contact.kids.length > 0) ||
    (Array.isArray(contact.interests) && contact.interests.length > 0) ||
    (!!contact.anniversary && !dateObjectIsEmpty(contact.anniversary)) ||
    (!!contact.birthday && !dateObjectIsEmpty(contact.birthday));

  const hasAddresses = addresses.length > 0;

  const availableLists = Array.isArray(mailingLists) ? mailingLists : [];
  const showMailingLists = availableLists.length > 0;
  const contactListIds = Array.isArray(contact.mailingLists) ? contact.mailingLists : [];
  const contactLists = availableLists.filter((l) => contactListIds.includes(l.id));

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const dataUri = 'data:image/jpeg;base64,' + result.assets[0].base64;
      onUpdate({ ...contact, photo: dataUri });
    }
  }

  async function exportVcf() {
    try {
      const vcf = makeVcf(contact);
      const filename = (displayName || 'contact').replace(/\s+/g, '_') + '.vcf';
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, vcf);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/vcard' });
      }
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  }

  function logToday() {
    onUpdate({ ...contact, lastContacted: isoToday() });
    showToast('Logged contact with ' + displayName);
  }

  const QBtn = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brdAc,
        backgroundColor: theme.bgAc,
      }}
    >
      <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 100,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BackButton onPress={onBack} />
          <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.bgAc,
              borderWidth: 1,
              borderColor: theme.brdAc,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, color: theme.ac }}>✎</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <View style={{ position: 'relative' }}>
            <Avatar contact={contact} size={64} onPress={pickPhoto} />
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.ac,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.bg,
              }}
            >
              <CameraIcon size={12} color={theme.bg} strokeWidth={2.5} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 22,
                  color: theme.t1,
                  fontWeight: '600',
                  fontFamily: theme.fontDisplay,
                  flexShrink: 1,
                }}
              >
                {displayName}
              </Text>
              {contact.priority && (
                <View
                  style={{
                    backgroundColor: theme.warn + '18',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.warn + '40',
                  }}
                >
                  <Text style={{ fontSize: 9, color: theme.warn, fontWeight: '700' }}>VIP</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: theme.t4, marginBottom: 8 }}>
              {contact.role}
              {contact.role && contact.company ? ' / ' : ''}
              {contact.company}
            </Text>
            {contact.tags?.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {contact.tags.map((t) => (
                  <TagPill key={t} tag={t} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          <QBtn label="Log Today" onPress={logToday} />
          {primaryPhone ? (
            <QBtn label="Call" onPress={() => Linking.openURL('tel:' + primaryPhone)} />
          ) : null}
          {primaryPhone ? (
            <QBtn label="Text" onPress={() => Linking.openURL('sms:' + primaryPhone)} />
          ) : null}
          {primaryEmail ? (
            <QBtn label="Email" onPress={() => Linking.openURL('mailto:' + primaryEmail)} />
          ) : null}
        </View>

        {/* AI Insights */}
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: theme.ac,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          AI Insights
        </Text>
        <AIPanel
          contact={contact}
          consumeAiCall={consumeAiCall}
          aiRemaining={aiRemaining}
          effectiveTier={effectiveTier}
          onUpdate={onUpdate}
        />

        {/* Contact Methods */}
        {(phones.length > 0 || emails.length > 0) && (
          <View style={{ marginBottom: 18 }}>
            {phones.map((p, i) => (
              <ContactMethodRow
                key={`phone-${i}`}
                label={p.label || 'Phone'}
                value={p.value}
                onPress={p.value ? () => Linking.openURL('tel:' + p.value) : null}
              />
            ))}
            {emails.map((e, i) => (
              <ContactMethodRow
                key={`email-${i}`}
                label={e.label || 'Email'}
                value={e.value}
                onPress={e.value ? () => Linking.openURL('mailto:' + e.value) : null}
              />
            ))}
          </View>
        )}

        {/* Other context */}
        {(contact.initialIntroduction || contact.location || contact.timezone) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7, marginBottom: 18 }}>
            {contact.initialIntroduction ? (
              <DRow label="Initial Introduction" value={contact.initialIntroduction} />
            ) : null}
            {contact.location ? <DRow label="Location" value={contact.location} /> : null}
            {contact.timezone ? <DRow label="Timezone" value={contact.timezone} /> : null}
          </View>
        ) : null}

        {/* Addresses */}
        {hasAddresses && (
          <View
            style={{
              backgroundColor: theme.bg2,
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.t4,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Addresses
            </Text>
            {addresses.map((a, i) => (
              <AddressBlock
                key={`addr-${i}`}
                address={a}
                isLast={i === addresses.length - 1}
              />
            ))}
            {!!contact.recipientName && (
              <Text style={{ fontSize: 11, color: theme.t5, marginTop: 4 }}>
                Mailing label: {contact.recipientName}
              </Text>
            )}
          </View>
        )}

        {/* Follow-up Schedule */}
        <FollowUpSchedule contact={contact} onUpdate={onUpdate} theme={theme} />

        {/* Contact Log */}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.brd, paddingTop: 16, marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: theme.t4,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Contact Log
          </Text>
          <ConvLog
            contact={contact}
            onUpdate={onUpdate}
            showToast={showToast}
            consumeAiCall={consumeAiCall}
            allowImport
            displayName={displayName}
            myCard={myCard}
            meetingSummaryLength={meetingSummaryLength}
          />
        </View>

        {/* Notes (manual only, AI never writes here) */}
        {contact.notes ? <DetailBlock label="Notes" content={contact.notes} /> : null}

        {/* Background */}
        {hasBackground && (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.brd, paddingTop: 16, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.t4,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Background & Experience
            </Text>
            {contact.experience ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Experience</Text>
                <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 19 }}>
                  {contact.experience}
                </Text>
              </View>
            ) : null}
            {Array.isArray(contact.pastCompanies) && contact.pastCompanies.length > 0 ? (
              <View>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Past Companies</Text>
                {contact.pastCompanies.map((pc, i) => (
                  <Text key={i} style={{ fontSize: 13, color: theme.t3, marginBottom: 2 }}>
                    {pc.company}
                    {pc.role ? ' / ' + pc.role : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* Personal */}
        {hasPersonal && (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.brd, paddingTop: 16, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.t4,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Personal
            </Text>
            {contact.hometown ? (
              <Text style={{ fontSize: 13, color: theme.t3, marginBottom: 6 }}>
                Hometown: {contact.hometown}
              </Text>
            ) : null}
            {contact.birthday && !dateObjectIsEmpty(contact.birthday) ? (
              <Text style={{ fontSize: 13, color: theme.t3, marginBottom: 6 }}>
                Birthday: {formatDateObject(contact.birthday)}
              </Text>
            ) : null}
            {contact.married ? (
              <Text
                style={{ fontSize: 13, color: theme.t3, marginBottom: 6, textTransform: 'capitalize' }}
              >
                Status: {contact.married}
                {contact.spouseName ? ' / ' + contact.spouseName : ''}
              </Text>
            ) : null}
            {contact.anniversary && !dateObjectIsEmpty(contact.anniversary) && contact.married === 'married' ? (
              <Text style={{ fontSize: 13, color: theme.t3, marginBottom: 6 }}>
                Anniversary: {formatDateObject(contact.anniversary)}
              </Text>
            ) : null}
            {Array.isArray(contact.kids) && contact.kids.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Kids:</Text>
                {contact.kids.map((k, i) => {
                  const kidAge = displayKidAge(k);
                  return (
                    <View key={i} style={{ marginBottom: k.notes ? 6 : 2 }}>
                      <Text style={{ fontSize: 13, color: theme.t3 }}>
                        {k.gender === 'girl' ? '(F)' : '(M)'}
                        {k.name ? ' ' + k.name : ''}
                        {kidAge ? ', ' + kidAge : ''}
                      </Text>
                      {k.notes ? (
                        <Text style={{ fontSize: 11, color: theme.t5, marginLeft: 24, marginTop: 1 }}>
                          {k.notes}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {Array.isArray(contact.interests) && contact.interests.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {contact.interests.map((t) => (
                  <View
                    key={t}
                    style={{
                      backgroundColor: '#7B5EEA18',
                      borderWidth: 1,
                      borderColor: '#7B5EEA40',
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{ color: '#9BAEE8', fontSize: 11, fontWeight: '500' }}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* Mailing Lists */}
        {showMailingLists && (
          <MailingListsBlock
            theme={theme}
            availableLists={availableLists}
            contactLists={contactLists}
            onToggle={(listId) => onToggleContactOnList && onToggleContactOnList(contact, listId)}
            contactName={displayName}
            showToast={showToast}
          />
        )}

        {/* Templates */}
        <Templates
          contact={contact}
          consumeAiCall={consumeAiCall}
          aiRemaining={aiRemaining}
          effectiveTier={effectiveTier}
        />

        {/* Export */}
        <TouchableOpacity
          onPress={exportVcf}
          style={{
            marginTop: 20,
            paddingVertical: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brd2,
            backgroundColor: theme.bg2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <DownloadIcon size={16} color={theme.ac} strokeWidth={2} />
          <Text style={{ color: theme.ac, fontSize: 13, fontWeight: '500' }}>
            Export to Contacts (.vcf)
          </Text>
        </TouchableOpacity>

        {/* Archive / Delete */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() =>
              confirmAction(
                'Archive',
                'Archive ' + displayName + '?',
                () => {
                  onArchive();
                  showToast(displayName + ' archived', theme.warn);
                },
                'Archive',
              )
            }
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.brdWarn,
              backgroundColor: theme.bgWarn,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ArchiveIcon size={14} color={theme.warn} strokeWidth={2} />
            <Text style={{ color: theme.warn, fontSize: 13, fontWeight: '500' }}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              confirmAction(
                'Delete',
                'Permanently delete ' + displayName + '? This cannot be undone.',
                onDelete,
                'Delete',
              )
            }
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.brdRed,
              backgroundColor: theme.bgRed,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.red, fontSize: 13, fontWeight: '500' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- Sub-components ----------

function MailingListsBlock({ theme, availableLists, contactLists, onToggle, contactName, showToast }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const onAnyList = contactLists.length > 0;

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: onAnyList ? 12 : 8 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: theme.t4,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Mailing Lists
        </Text>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: theme.bgAc,
            borderWidth: 1,
            borderColor: theme.brdAc,
          }}
        >
          <Text style={{ fontSize: 11, color: theme.ac, fontWeight: '600' }}>
            {onAnyList ? 'Manage' : '+ Add to a list'}
          </Text>
        </TouchableOpacity>
      </View>

      {onAnyList ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {contactLists.map((list) => (
            <TouchableOpacity
              key={list.id}
              onPress={() => {
                onToggle(list.id);
                showToast && showToast('Removed from ' + list.name);
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor: theme.bgAc,
                borderColor: theme.ac,
              }}
            >
              <MailIcon size={11} color={theme.ac} />
              <Text style={{ fontSize: 12, color: theme.ac, fontWeight: '600' }}>
                {list.name}
              </Text>
              <XIcon size={11} color={theme.ac} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 12, color: theme.t6 }}>
          Not on any mailing lists yet.
        </Text>
      )}

      <ListPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        availableLists={availableLists}
        contactLists={contactLists}
        onToggle={onToggle}
        contactName={contactName}
      />
    </View>
  );
}

function ListPickerModal({ visible, onClose, availableLists, contactLists, onToggle, contactName }) {
  const { theme } = useTheme();
  const onIds = new Set(contactLists.map((l) => l.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
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
            padding: 18,
            width: '100%',
            maxWidth: 420,
            maxHeight: '70%',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 16, color: theme.t1, fontWeight: '600', fontFamily: theme.fontDisplay }}>
              Mailing Lists
            </Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={18} color={theme.t4} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 12 }}>
            Tap to add or remove {contactName || 'this contact'}.
          </Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {availableLists.map((list) => {
              const on = onIds.has(list.id);
              return (
                <TouchableOpacity
                  key={list.id}
                  onPress={() => onToggle(list.id)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: on ? theme.ac : theme.brd2,
                    backgroundColor: on ? theme.bgAc : theme.bg2,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: on ? theme.ac : theme.brd2,
                      backgroundColor: on ? theme.ac : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on && (
                      <Text style={{ color: theme.bg, fontSize: 12, fontWeight: '700', lineHeight: 14 }}>
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: on ? theme.ac : theme.t1,
                      fontWeight: on ? '600' : '500',
                    }}
                  >
                    {list.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: theme.ac,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function ContactMethodRow({ label, value, onPress }) {
  const { theme } = useTheme();
  if (!value) return null;
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.brd,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: theme.t5,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          width: 90,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontSize: 13, color: onPress ? theme.info : theme.t2, flex: 1, textAlign: 'right' }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </Wrap>
  );
}

function AddressBlock({ address, isLast }) {
  const { theme } = useTheme();
  if (!address) return null;
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', ') +
      (address.zip ? ' ' + address.zip : ''),
    address.country,
  ].filter((l) => l && l.trim());
  if (lines.length === 0) return null;
  return (
    <View
      style={{
        marginBottom: isLast ? 0 : 12,
        paddingBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.brd,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: theme.t5,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {address.label || 'Address'}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ fontSize: 13, color: theme.t3, lineHeight: 19 }}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function DRow({ label, value, onPress }) {
  const { theme } = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <View style={{ width: '50%', paddingHorizontal: 7, marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: theme.t5,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Wrap onPress={onPress}>
        <Text style={{ fontSize: 13, color: onPress ? theme.info : theme.t2 }} numberOfLines={2}>
          {value}
        </Text>
      </Wrap>
    </View>
  );
}

function DetailBlock({ label, content }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: theme.t4,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 21 }}>{content}</Text>
    </View>
  );
}

// ============================================================
// AI panel: Meeting Prep / Background / Ask AI
// ============================================================
function AIPanel({ contact, consumeAiCall, aiRemaining, effectiveTier, onUpdate }) {
  const { theme } = useTheme();
  const [askOpen, setAskOpen] = useState(false);
  const [bgExpanded, setBgExpanded] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const [bgError, setBgError] = useState('');
  const [prepExpanded, setPrepExpanded] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState('');

  const savedBackground = contact.aiBackgroundSummary || '';
  const savedPrep = contact.aiMeetingPrep || '';

  async function generatePrep() {
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    setPrepLoading(true);
    setPrepError('');
    try {
      const r = await aiMeetingPrep(contact);
      if (onUpdate) {
        onUpdate({ ...contact, aiMeetingPrep: r, aiMeetingPrepUpdatedAt: Date.now() });
      }
      setPrepExpanded(true);
    } catch (_) {
      setPrepError('Failed to generate. Try again.');
    }
    setPrepLoading(false);
  }

  function onPrepButtonPress() {
    if (prepLoading) return;
    if (savedPrep) {
      setPrepExpanded((e) => !e);
    } else {
      generatePrep();
    }
  }

  async function generateBackground() {
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    setBgLoading(true);
    setBgError('');
    try {
      const r = await aiBackground(contact);
      if (onUpdate) {
        onUpdate({ ...contact, aiBackgroundSummary: r, aiBackgroundUpdatedAt: Date.now() });
      }
      setBgExpanded(true);
    } catch (_) {
      setBgError('Failed to generate. Try again.');
    }
    setBgLoading(false);
  }

  function onBackgroundButtonPress() {
    if (bgLoading) return;
    if (savedBackground) {
      setBgExpanded((e) => !e);
    } else {
      generateBackground();
    }
  }

  function deleteBackground() {
    if (onUpdate) {
      onUpdate({ ...contact, aiBackgroundSummary: '', aiBackgroundUpdatedAt: null });
    }
    setBgExpanded(false);
    setBgError('');
  }

  function deletePrep() {
    if (onUpdate) {
      onUpdate({ ...contact, aiMeetingPrep: '', aiMeetingPrepUpdatedAt: null });
    }
    setPrepExpanded(false);
    setPrepError('');
  }

  const renderDeleteAction = (onDelete) => () => (
    <TouchableOpacity
      onPress={onDelete}
      activeOpacity={0.85}
      style={{
        width: 80,
        backgroundColor: theme.red,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Delete</Text>
    </TouchableOpacity>
  );

  const Btn = ({ label, onPress, color, bgColor, brdColor }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: brdColor,
        backgroundColor: bgColor,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Btn
          label="Meeting Prep"
          onPress={onPrepButtonPress}
          color={theme.ac}
          bgColor={theme.bgAc}
          brdColor={theme.brdAc}
        />
        <Btn
          label="Background"
          onPress={onBackgroundButtonPress}
          color={theme.ac}
          bgColor={theme.bgAc}
          brdColor={theme.brdAc}
        />
        <Btn
          label="Ask AI"
          onPress={() => setAskOpen(true)}
          color={theme.purp}
          bgColor={theme.purp + '15'}
          brdColor={theme.purp + '50'}
        />
      </View>
      {effectiveTier === 'free' && Number.isFinite(aiRemaining) ? (
        <Text style={{ fontSize: 10, color: theme.t6, marginTop: -2 }}>
          {aiRemaining} of 5 AI calls remaining this month
        </Text>
      ) : null}
      {(savedPrep || prepLoading || prepError) ? (
        <Swipeable
          renderRightActions={savedPrep ? renderDeleteAction(deletePrep) : undefined}
          overshootRight={false}
        >
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brd,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={() => savedPrep && !prepLoading && setPrepExpanded((e) => !e)}
            activeOpacity={savedPrep && !prepLoading ? 0.7 : 1}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
              Meeting Prep
            </Text>
            {prepLoading ? (
              <ActivityIndicator color={theme.ac} size="small" />
            ) : savedPrep ? (
              <View style={{ transform: [{ rotate: prepExpanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={14} color={theme.t5} />
              </View>
            ) : null}
          </TouchableOpacity>
          {prepLoading && !savedPrep ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>
                Generating...
              </Text>
            </View>
          ) : null}
          {!prepLoading && prepError && !savedPrep ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Text style={{ color: theme.warn, fontSize: 12 }}>{prepError}</Text>
            </View>
          ) : null}
          {savedPrep && prepExpanded && !prepLoading ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <MarkdownText text={savedPrep} theme={theme} />
              {prepError ? (
                <Text style={{ color: theme.warn, fontSize: 11 }}>{prepError}</Text>
              ) : null}
              <TouchableOpacity
                onPress={generatePrep}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                  backgroundColor: theme.bgAc,
                }}
              >
                <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>
                  Update with AI
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        </Swipeable>
      ) : null}

      {(savedBackground || bgLoading || bgError) ? (
        <Swipeable
          renderRightActions={savedBackground ? renderDeleteAction(deleteBackground) : undefined}
          overshootRight={false}
        >
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brd,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={() => savedBackground && !bgLoading && setBgExpanded((e) => !e)}
            activeOpacity={savedBackground && !bgLoading ? 0.7 : 1}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
              Background
            </Text>
            {bgLoading ? (
              <ActivityIndicator color={theme.ac} size="small" />
            ) : savedBackground ? (
              <View style={{ transform: [{ rotate: bgExpanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={14} color={theme.t5} />
              </View>
            ) : null}
          </TouchableOpacity>
          {bgLoading && !savedBackground ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>
                Generating...
              </Text>
            </View>
          ) : null}
          {!bgLoading && bgError && !savedBackground ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <Text style={{ color: theme.warn, fontSize: 12 }}>{bgError}</Text>
            </View>
          ) : null}
          {savedBackground && bgExpanded && !bgLoading ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <MarkdownText text={savedBackground} theme={theme} />
              {bgError ? (
                <Text style={{ color: theme.warn, fontSize: 11 }}>{bgError}</Text>
              ) : null}
              <TouchableOpacity
                onPress={generateBackground}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                  backgroundColor: theme.bgAc,
                }}
              >
                <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>
                  Update with AI
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        </Swipeable>
      ) : null}

      <AskAIModal
        visible={askOpen}
        onClose={() => setAskOpen(false)}
        contact={contact}
        consumeAiCall={consumeAiCall}
      />
    </View>
  );
}

// ============================================================
// Ask AI modal: chat-style Q&A about the contact
//
// Chat history is local to this modal instance. Closing wipes it,
// per spec. Each user message = 1 AI call against quota.
// ============================================================
function AskAIModal({ visible, onClose, contact, consumeAiCall }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const displayName = getDisplayName(contact);

  // Wipe chat whenever the modal opens. "Fresh chat each open."
  useEffect(() => {
    if (visible) {
      setMessages([]);
      setInput('');
      setLoading(false);
    }
  }, [visible]);

  function scrollToBottom() {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 50);
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    const historyBeforeSend = messages;
    const userMsg = { role: 'user', content: trimmed };
    setMessages([...historyBeforeSend, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();
    try {
      const reply = await aiAnswerQuestion(contact, historyBeforeSend, trimmed);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, that failed. Try again.' },
      ]);
    }
    setLoading(false);
    scrollToBottom();
  }

  const suggestionPrompts = [
    'When did we last talk?',
    'What does ' + (displayName.split(' ')[0] || 'this person') + ' care about?',
    'What should I follow up on?',
    'Any open commitments?',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: theme.bg,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: theme.brd,
              height: '88%',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme.brd,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 17,
                    color: theme.t1,
                    fontWeight: '600',
                    fontFamily: theme.fontDisplay,
                  }}
                >
                  Ask AI about {displayName.split(' ')[0] || 'this contact'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.t5, marginTop: 2 }}>
                  AI uses everything saved on this contact card
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <XIcon size={20} color={theme.t4} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 10,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && !loading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: theme.purp + '20',
                      borderWidth: 1,
                      borderColor: theme.purp + '50',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChatIcon size={22} color={theme.purp} />
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.t4,
                      textAlign: 'center',
                      lineHeight: 19,
                      paddingHorizontal: 20,
                    }}
                  >
                    Ask anything about {displayName.split(' ')[0] || 'this contact'}.{'\n'}
                    Past conversations, personal details, follow-ups.
                  </Text>
                  <View style={{ width: '100%', gap: 6, marginTop: 8 }}>
                    {suggestionPrompts.map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setInput(p)}
                        activeOpacity={0.7}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.brd2,
                          backgroundColor: theme.bg2,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: theme.t3 }}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} theme={theme} />
              ))}

              {loading && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: theme.bg2,
                    borderWidth: 1,
                    borderColor: theme.brd,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ActivityIndicator color={theme.purp} size="small" />
                  <Text style={{ fontSize: 12, color: theme.t4 }}>Thinking...</Text>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View
              style={{
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 12),
                borderTopWidth: 1,
                borderTopColor: theme.brd,
                backgroundColor: theme.bg,
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 8,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask anything..."
                placeholderTextColor={theme.t6}
                multiline
                style={{
                  flex: 1,
                  backgroundColor: theme.bg2,
                  borderWidth: 1,
                  borderColor: theme.brd2,
                  borderRadius: 18,
                  color: theme.t1,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 14,
                  maxHeight: 100,
                  minHeight: 40,
                  fontFamily: theme.fontBody,
                }}
              />
              <TouchableOpacity
                onPress={send}
                disabled={!input.trim() || loading}
                activeOpacity={0.7}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.purp,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !input.trim() || loading ? 0.4 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -2 }}>
                  ↑
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChatBubble({ role, content, theme }) {
  const isUser = role === 'user';
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        backgroundColor: isUser ? theme.purp : theme.bg2,
        borderWidth: isUser ? 0 : 1,
        borderColor: theme.brd,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
      }}
    >
      {isUser ? (
        <Text
          style={{
            fontSize: 14,
            color: '#fff',
            lineHeight: 20,
            fontFamily: theme.fontBody,
          }}
        >
          {content}
        </Text>
      ) : (
        <MarkdownText text={content} theme={theme} />
      )}
    </View>
  );
}

function MarkdownText({ text, theme }) {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={i} style={{ height: 8 }} />;
        }

        const fullBoldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
        if (fullBoldMatch) {
          const headerText = fullBoldMatch[1];
          const isMajor = headerText === headerText.toUpperCase();
          return (
            <Text
              key={i}
              style={{
                fontSize: isMajor ? 13 : 12,
                fontWeight: '700',
                color: isMajor ? theme.ac : theme.t1,
                letterSpacing: isMajor ? 0.4 : 0,
                marginTop: isMajor ? 12 : 8,
                marginBottom: 4,
              }}
            >
              {headerText}
            </Text>
          );
        }

        if (trimmed.startsWith('- ')) {
          const content = trimmed.slice(2);
          return (
            <Text
              key={i}
              style={{
                fontSize: 13,
                color: theme.t3,
                lineHeight: 21,
                marginBottom: 3,
                paddingLeft: 4,
              }}
            >
              <Text style={{ color: theme.t4 }}>{'•  '}</Text>
              {renderInline(content, theme)}
            </Text>
          );
        }

        return (
          <Text
            key={i}
            style={{
              fontSize: 13,
              color: theme.t3,
              lineHeight: 21,
              marginBottom: 3,
            }}
          >
            {renderInline(trimmed, theme)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text, theme) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p && p.length > 0);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <Text key={idx} style={{ fontWeight: '700', color: theme.t1 }}>
          {m[1]}
        </Text>
      );
    }
    return part;
  });
}

function Templates({ contact, consumeAiCall, aiRemaining, effectiveTier }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selType, setSelType] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate(type) {
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    setSelType(type);
    setResult('');
    setLoading(true);
    try {
      const r = await aiTemplate(contact, type);
      setResult(r);
    } catch (_) {
      setResult('Failed to generate.');
    }
    setLoading(false);
  }

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        marginTop: 14,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MailIcon size={18} color={theme.info} />
          <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}>
            Outreach Templates
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <ChevronDown size={14} color={theme.t5} />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
          {TEMPLATE_TYPES.map((tt) => (
            <TouchableOpacity
              key={tt.v}
              onPress={() => generate(tt.v)}
              style={{
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                backgroundColor: selType === tt.v ? '#48B8E012' : theme.bg3,
                borderColor: selType === tt.v ? theme.info : theme.brd,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: selType === tt.v ? theme.info : theme.t2,
                }}
              >
                {tt.l}
              </Text>
              <Text style={{ fontSize: 10, color: theme.t5, marginTop: 2 }}>{tt.desc}</Text>
            </TouchableOpacity>
          ))}
          {loading && (
            <View
              style={{
                backgroundColor: theme.bg3,
                padding: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ActivityIndicator color={theme.info} size="small" />
              <Text style={{ color: theme.info, fontSize: 12, fontWeight: '600' }}>
                Writing template...
              </Text>
            </View>
          )}
          {result && !loading && (
            <View style={{ backgroundColor: theme.bg3, padding: 14, borderRadius: 12 }}>
              <MarkdownText text={result} theme={theme} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function FollowUpSchedule({ contact, onUpdate, theme }) {
  const [editing, setEditing] = useState(false);
  const freq = contact.freq;
  const hasFreq = freq && freq !== 'never';
  const fl = FREQ.find((o) => o.v === freq);
  const nd = nextDate(contact.lastContacted, contact.freq, contact.freqStartedAt, contact.freqDayOfWeek);
  const ndDiff = nd ? daysUntil(nd) : null;
  const dayLabel =
    contact.freqDayOfWeek != null
      ? DAYS_OF_WEEK[contact.freqDayOfWeek]?.l
      : null;
  const customFollowUp = contact.customFollowUpDate
    ? formatFlexibleDate(contact.customFollowUpDate)
    : '';
  const hasAnySchedule = hasFreq || !!customFollowUp;

  function pickFreq(v) {
    const update = { ...contact, freq: v };
    if (v && v !== 'never') {
      if (!contact.freqStartedAt) update.freqStartedAt = isoToday();
      if (v === '1week' && contact.freqDayOfWeek == null) {
        update.freqDayOfWeek = new Date().getDay();
      }
    } else {
      update.freqStartedAt = '';
      update.freqDayOfWeek = null;
    }
    onUpdate(update);
  }

  function pickDay(dayValue) {
    onUpdate({ ...contact, freqDayOfWeek: dayValue });
  }

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: hasAnySchedule || editing ? 10 : 4,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: theme.t4,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Follow-up Schedule
        </Text>
        {!hasAnySchedule && !editing ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: theme.bgAc,
              borderWidth: 1,
              borderColor: theme.brdAc,
            }}
          >
            <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>
              + Set frequency
            </Text>
          </TouchableOpacity>
        ) : hasAnySchedule && !editing ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: theme.brd2,
              backgroundColor: theme.bg3,
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 10, fontWeight: '600' }}>
              Change
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setEditing(false)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: theme.brdAc,
              backgroundColor: theme.bgAc,
            }}
          >
            <Text style={{ color: theme.ac, fontSize: 10, fontWeight: '600' }}>
              Done
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!hasAnySchedule && !editing && (
        <Text style={{ fontSize: 12, color: theme.t6 }}>
          No follow-up schedule yet.
        </Text>
      )}

      {hasAnySchedule && !editing && (
        <>
          {hasFreq && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: theme.t5 }}>Frequency</Text>
              <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '500' }}>
                {fl ? fl.l : ''}
              </Text>
            </View>
          )}
          {dayLabel && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: theme.t5 }}>Day</Text>
              <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '500' }}>
                {dayLabel}
              </Text>
            </View>
          )}
          {nd && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: customFollowUp ? 4 : 0 }}>
              <Text style={{ fontSize: 12, color: theme.t5 }}>Next contact</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: ndDiff < 0 ? theme.red : ndDiff <= 7 ? theme.warn : theme.ac,
                }}
              >
                {fmtDate(nd)} (
                {ndDiff < 0
                  ? Math.abs(ndDiff) + 'd overdue'
                  : ndDiff === 0
                    ? 'today'
                    : ndDiff + 'd'}
                )
              </Text>
            </View>
          )}
          {customFollowUp ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: theme.t5 }}>One-off follow-up</Text>
              <Text style={{ fontSize: 12, color: theme.warn, fontWeight: '600' }}>
                {customFollowUp}
              </Text>
            </View>
          ) : null}
        </>
      )}

      {editing && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FREQ.map((o) => {
              const on = freq === o.v;
              return (
                <TouchableOpacity
                  key={o.v}
                  onPress={() => pickFreq(o.v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 9,
                    borderWidth: 1,
                    backgroundColor: on ? theme.bgAc : theme.bg3,
                    borderColor: on ? theme.ac : theme.brd,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: on ? theme.ac : theme.t4,
                      fontWeight: '600',
                    }}
                  >
                    {o.l}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {freq === '1week' && (
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: theme.t5,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Day of week
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {DAYS_OF_WEEK.map((d) => {
                  const on = contact.freqDayOfWeek === d.v;
                  return (
                    <TouchableOpacity
                      key={d.v}
                      onPress={() => pickDay(d.v)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: on ? theme.bgAc : theme.bg3,
                        borderColor: on ? theme.ac : theme.brd,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          color: on ? theme.ac : theme.t5,
                          fontWeight: '600',
                        }}
                      >
                        {d.s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {nd && (
            <View
              style={{
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: theme.brd,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 11, color: theme.t5 }}>Next contact</Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: ndDiff < 0 ? theme.red : ndDiff <= 7 ? theme.warn : theme.ac,
                }}
              >
                {fmtDate(nd)}
              </Text>
            </View>
          )}

          <Text style={{ fontSize: 10, color: theme.t6, fontStyle: 'italic' }}>
            To set a one-off custom follow-up date, use the full Edit screen.
          </Text>
        </View>
      )}
    </View>
  );
}