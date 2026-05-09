import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
} from '../utils/helpers';
import {
  FREQ,
  TOUCH_TYPES,
  TEMPLATE_TYPES,
  getPrimaryPhone,
  getPrimaryEmail,
  formatFlexibleDate,
} from '../constants';
import { aiMeetingPrep, aiBackground, aiTemplate, aiExtractMeetingNote } from '../utils/ai';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!contact) return null;

  const nd = nextDate(contact.lastContacted, contact.freq);
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
      const filename = (contact.name || 'contact').replace(/\s+/g, '_') + '.vcf';
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
    showToast('Logged contact with ' + contact.name);
  }

  const QBtn = ({ label, onPress, gold }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: gold ? theme.gold : theme.brdAc,
        backgroundColor: gold ? theme.bgGold : theme.bgAc,
      }}
    >
      <Text style={{ color: gold ? theme.gold : theme.ac, fontSize: 12, fontWeight: '600' }}>{label}</Text>
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
                {contact.name}
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
          <QBtn label="Log Today" onPress={logToday} gold />
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
        />

        {/* Contact Methods */}
        {(phones.length > 0 || emails.length > 0 || contact.linkedin) && (
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
            {contact.linkedin ? (
              <ContactMethodRow
                label="LinkedIn"
                value={contact.linkedin.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')}
                onPress={() =>
                  Linking.openURL(
                    contact.linkedin.startsWith('http')
                      ? contact.linkedin
                      : 'https://linkedin.com/in/' + contact.linkedin,
                  )
                }
              />
            ) : null}
          </View>
        )}

        {/* Other context fields */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -7, marginBottom: 18 }}>
          {contact.howMet ? <DRow label="How We Met" value={contact.howMet} /> : null}
          {contact.howHelp ? <DRow label="How I Can Help" value={contact.howHelp} /> : null}
          {contact.lastContacted ? (() => {
            const d = daysSince(contact.lastContacted);
            const suffix = d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + 'd ago';
            return (
              <DRow
                label="Last Contacted"
                value={fmtDate(contact.lastContacted) + ' (' + suffix + ')'}
              />
            );
          })() : null}
          {contact.location ? <DRow label="Location" value={contact.location} /> : null}
          {contact.timezone ? <DRow label="Timezone" value={contact.timezone} /> : null}
        </View>

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

        {/* Mailing Lists */}
        {showMailingLists && (
          <MailingListsBlock
            theme={theme}
            availableLists={availableLists}
            contactLists={contactLists}
            onToggle={(listId) => onToggleContactOnList && onToggleContactOnList(contact, listId)}
            contactName={contact.name}
            showToast={showToast}
          />
        )}

        {/* Follow-up Schedule */}
        {contact.freq && contact.freq !== 'never' && (
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
                marginBottom: 10,
              }}
            >
              Follow-up Schedule
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: theme.t5 }}>Frequency</Text>
              <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '500' }}>
                {fl ? fl.l : ''}
              </Text>
            </View>
            {nd && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
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
          </View>
        )}

        {contact.topics ? (
          <DetailBlock label="Key Topics" content={contact.topics} />
        ) : null}
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

        {/* Conversation Log */}
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
          />
        </View>

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
              Alert.alert('Archive', 'Archive ' + contact.name + '?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Archive',
                  onPress: () => {
                    onArchive();
                    showToast(contact.name + ' archived', theme.warn);
                  },
                },
              ])
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
              Alert.alert('Delete', 'Permanently delete ' + contact.name + '? This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ])
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
  const insets = useSafeAreaInsets();
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

function AIPanel({ contact, consumeAiCall, aiRemaining, effectiveTier }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(type) {
    // Gate behind tier — bails out and triggers paywall if free user is at cap.
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    setMode(type);
    setResult('');
    setLoading(true);
    try {
      let r = '';
      if (type === 'prep') r = await aiMeetingPrep(contact);
      else if (type === 'background') r = await aiBackground(contact);
      setResult(r);
    } catch (_) {
      setResult('Failed to generate. Try again.');
    }
    setLoading(false);
  }

  const Btn = ({ label, type, color, bgColor, brdColor }) => (
    <TouchableOpacity
      onPress={() => run(type)}
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
        <Btn label="Meeting Prep" type="prep" color={theme.ac} bgColor={theme.bgAc} brdColor={theme.brdAc} />
        <Btn label="Background" type="background" color={theme.ac} bgColor={theme.bgAc} brdColor={theme.brdAc} />
      </View>
      {/* AI counter, only shown to free users (not Pro/trial). */}
      {effectiveTier === 'free' && Number.isFinite(aiRemaining) ? (
        <Text style={{ fontSize: 10, color: theme.t6, marginTop: -2 }}>
          {aiRemaining} of 5 AI calls remaining this month
        </Text>
      ) : null}
      {(loading || result) && (
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.brd,
          }}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={theme.ac} size="small" />
              <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>
                Generating...
              </Text>
            </View>
          ) : (
            <MarkdownText text={result} theme={theme} />
          )}
        </View>
      )}
    </View>
  );
}

// ----- Lightweight markdown renderer for AI output -----

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

// ----- Conversation Log component with Add Note + Import Notes flows -----

function ConvLog({ contact, onUpdate, showToast, consumeAiCall }) {
  const { theme } = useTheme();
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [touchType, setTouchType] = useState('call');
  // Track which entries are expanded. Most recent stays open by default.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  // Transcript modal state
  const [transcriptModal, setTranscriptModal] = useState(null); // entry object or null
  const log = contact.convLog || [];

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    if (!note.trim()) return;
    const entry = {
      id: String(Date.now()),
      date: isoToday(),
      text: note.trim(),
      type: touchType,
    };
    onUpdate({ ...contact, convLog: [entry, ...log], lastContacted: entry.date });
    setNote('');
    setAdding(false);
    setTouchType('call');
  }

  function getType(t) {
    return TOUCH_TYPES.find((x) => x.v === t) || TOUCH_TYPES[5];
  }

  function handleImportSave(extracted, date, type, rawTranscript) {
    const entry = {
      id: String(Date.now()),
      date: date || isoToday(),
      text: extracted,
      type: type || 'meeting',
    };
    if (rawTranscript && rawTranscript.trim()) {
      entry.rawTranscript = rawTranscript.trim();
    }
    onUpdate({ ...contact, convLog: [entry, ...log], lastContacted: entry.date });
    setImporting(false);
    showToast && showToast('Note imported');
  }

  // Build a one-line preview for collapsed entries.
  function preview(text) {
    if (!text) return '';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length > 80 ? oneLine.slice(0, 80).trim() + '...' : oneLine;
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <TouchableOpacity
          onPress={() => {
            setImporting(true);
            setAdding(false);
          }}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: theme.bg2,
            borderColor: theme.brd2,
          }}
        >
          <Text style={{ color: theme.info, fontSize: 11, fontWeight: '600' }}>
            Import Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setAdding((a) => !a);
            setImporting(false);
          }}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            backgroundColor: adding ? theme.bgRed : theme.bgAc,
            borderColor: adding ? '#3A1838' : theme.brdAc,
          }}
        >
          <Text
            style={{
              color: adding ? theme.pink : theme.ac,
              fontSize: 11,
              fontWeight: '600',
            }}
          >
            {adding ? 'Cancel' : '+ Add Note'}
          </Text>
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {TOUCH_TYPES.map((tt) => (
              <TouchableOpacity
                key={tt.v}
                onPress={() => setTouchType(tt.v)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  backgroundColor: touchType === tt.v ? tt.c + '22' : theme.bg3,
                  borderColor: touchType === tt.v ? tt.c : theme.brd,
                }}
              >
                <Text
                  style={{
                    color: touchType === tt.v ? tt.c : theme.t5,
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                >
                  {tt.l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInputBox value={note} onChangeText={setNote} placeholder="What did you discuss?" />
          <TouchableOpacity
            onPress={add}
            style={{
              backgroundColor: theme.ac,
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 12,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Save Note</Text>
          </TouchableOpacity>
        </View>
      )}

      <ImportNotesModal
        visible={importing}
        onClose={() => setImporting(false)}
        contact={contact}
        onSave={handleImportSave}
        consumeAiCall={consumeAiCall}
      />

      {log.length === 0 && !adding ? (
        <Text style={{ fontSize: 12, color: theme.t6 }}>
          No notes yet. Tap + Add Note after a conversation, or paste a meeting transcript with Import Notes.
        </Text>
      ) : null}
      {log.map((e, i) => {
        const tt = getType(e.type);
        // Expand by default if it's the most recent entry, OR if user toggled it open.
        const isExpanded = (i === 0 && !expandedIds.has(`__collapsed:${e.id}`)) || expandedIds.has(e.id);
        const hasTranscript = !!(e.rawTranscript && e.rawTranscript.trim());

        return (
          <LogEntry
            key={e.id}
            entry={e}
            tt={tt}
            isFirst={i === 0}
            isExpanded={isExpanded}
            hasTranscript={hasTranscript}
            previewText={preview(e.text)}
            adding={adding}
            theme={theme}
            onToggle={() => {
              // For the default-open most recent, we use a sentinel key to remember "user collapsed it"
              if (i === 0 && !expandedIds.has(e.id) && !expandedIds.has(`__collapsed:${e.id}`)) {
                // Default-open and being collapsed: store the sentinel
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.add(`__collapsed:${e.id}`);
                  return next;
                });
                return;
              }
              if (i === 0 && expandedIds.has(`__collapsed:${e.id}`)) {
                // Default-open was collapsed, now reopening: clear sentinel
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(`__collapsed:${e.id}`);
                  return next;
                });
                return;
              }
              toggleExpanded(e.id);
            }}
            onDelete={() =>
              onUpdate({ ...contact, convLog: log.filter((x) => x.id !== e.id) })
            }
            onViewTranscript={() => setTranscriptModal(e)}
          />
        );
      })}

      <TranscriptModal
        entry={transcriptModal}
        onClose={() => setTranscriptModal(null)}
      />
    </View>
  );
}

// ----- A single conversation log entry, collapsible -----

function LogEntry({
  entry,
  tt,
  isFirst,
  isExpanded,
  hasTranscript,
  previewText,
  adding,
  theme,
  onToggle,
  onDelete,
  onViewTranscript,
}) {
  return (
    <View
      style={{
        borderTopWidth: isFirst && !adding ? 0 : 1,
        borderTopColor: theme.brd,
        paddingTop: isFirst && !adding ? 0 : 10,
        marginTop: isFirst && !adding ? 0 : 10,
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.6}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Text style={{ fontSize: 10, color: tt.c, fontWeight: '600' }}>{tt.l}</Text>
          <Text style={{ fontSize: 10, color: theme.t6 }}>{fmtDate(entry.date)}</Text>
          {hasTranscript ? (
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: theme.bg3,
                borderWidth: 1,
                borderColor: theme.brd,
              }}
            >
              <Text style={{ fontSize: 8, color: theme.t5, fontWeight: '700', letterSpacing: 0.3 }}>
                T
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
            <ChevronDown size={12} color={theme.t5} />
          </View>
          {isExpanded ? (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <XIcon size={14} color={theme.t6} />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      {!isExpanded ? (
        <TouchableOpacity onPress={onToggle} activeOpacity={0.6}>
          <Text
            style={{
              fontSize: 12,
              color: theme.t5,
              lineHeight: 17,
              marginTop: 2,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {previewText}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 21 }}>{entry.text}</Text>
          {hasTranscript ? (
            <TouchableOpacity
              onPress={onViewTranscript}
              style={{
                marginTop: 8,
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.brd2,
                backgroundColor: theme.bg2,
              }}
            >
              <Text style={{ fontSize: 11, color: theme.info, fontWeight: '600' }}>
                View transcript
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ----- Modal for viewing the raw transcript of an entry -----

function TranscriptModal({ entry, onClose }) {
  const { theme } = useTheme();
  const visible = !!entry;
  const transcript = entry?.rawTranscript || '';

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
            maxWidth: 600,
            maxHeight: '85%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
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
              Transcript
            </Text>
            <TouchableOpacity onPress={onClose}>
              <XIcon size={18} color={theme.t4} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 12 }}>
            {entry ? fmtDate(entry.date) : ''}
          </Text>

          <ScrollView style={{ maxHeight: 480 }}>
            <Text
              style={{
                fontSize: 12,
                color: theme.t3,
                lineHeight: 19,
                fontFamily: theme.fontBody,
              }}
            >
              {transcript || 'No transcript saved for this entry.'}
            </Text>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 12,
              paddingVertical: 11,
              borderRadius: 12,
              backgroundColor: theme.ac,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ----- Import Notes modal -----
//
// User pastes raw meeting content (Granola export, Otter transcript,
// Zoom AI summary, anything). On Extract, calls aiExtractMeetingNote
// which returns a clean summary. User can review/edit before saving.
// The original raw paste is also saved as rawTranscript on the entry
// so it can be viewed later.

// Heuristic: does the AI's extracted summary indicate the conversation
// wasn't actually about this contact? When that's true we surface a
// confirmation dialog instead of silently saving an unhelpful log entry.
//
// We check the first ~200 chars to keep this snappy. Phrases here are based
// on common ways Claude flags off-topic transcripts.
function summaryFlagsAsIrrelevant(summary, contactName) {
  if (!summary) return false;
  const head = summary.slice(0, 280).toLowerCase();
  const phrases = [
    'not relevant',
    'no mention of',
    "doesn't mention",
    'does not mention',
    'should not be logged',
    'nothing to log',
    'nothing here should be logged',
    'no relevant content',
    'not about',
  ];
  if (phrases.some((p) => head.includes(p))) return true;

  // Also flag if the contact's first name appears nowhere in the full summary
  // AND the summary is short enough that this is a meaningful signal.
  // Skip this check for very long summaries, since the contact is probably mentioned somewhere.
  if (contactName && summary.length < 400) {
    const firstName = contactName.trim().split(/\s+/)[0];
    if (firstName && firstName.length >= 3) {
      const re = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!re.test(summary)) return true;
    }
  }

  return false;
}

function ImportNotesModal({ visible, onClose, contact, onSave, consumeAiCall }) {
  const { theme } = useTheme();
  const [raw, setRaw] = useState('');
  const [extracted, setExtracted] = useState('');
  const [date, setDate] = useState(isoToday());
  const [type, setType] = useState('meeting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // When the AI's output looks irrelevant to this contact, hold the result
  // here and show a confirmation card instead of dropping it straight into
  // the editable box. Stays as a string (not boolean) so we can populate
  // the editable summary if the user picks "Save anyway".
  const [pendingIrrelevant, setPendingIrrelevant] = useState('');

  function reset() {
    setRaw('');
    setExtracted('');
    setDate(isoToday());
    setType('meeting');
    setLoading(false);
    setError('');
    setPendingIrrelevant('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function extract() {
    if (!raw.trim()) return;
    if (consumeAiCall) {
      const allowed = await consumeAiCall('ai_limit_reached');
      if (!allowed) return;
    }
    setLoading(true);
    setError('');
    setPendingIrrelevant('');
    try {
      const result = await aiExtractMeetingNote(contact, raw);
      // If the extraction looks like the AI is flagging the transcript as
      // irrelevant to this contact, surface a confirmation card instead of
      // populating the editable box. Avoids the user having to read garbage
      // text just to figure out whether to save or cancel.
      if (summaryFlagsAsIrrelevant(result, contact?.name)) {
        setPendingIrrelevant(result);
        setExtracted('');
      } else {
        setExtracted(result);
      }
    } catch (e) {
      setError('Failed to extract. Try again.');
    }
    setLoading(false);
  }

  function confirmIrrelevant() {
    // User chose "Save anyway" — populate the editable box and clear the warning.
    setExtracted(pendingIrrelevant);
    setPendingIrrelevant('');
  }

  function cancelIrrelevant() {
    // User chose "Cancel" — drop the irrelevant summary, leave the raw paste in place.
    setPendingIrrelevant('');
    setExtracted('');
  }

  function save() {
    if (!extracted.trim()) return;
    // Pass the raw paste as rawTranscript so it can be viewed later.
    onSave(extracted.trim(), date, type, raw);
    reset();
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
            maxWidth: 520,
            maxHeight: '85%',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header (fixed) */}
          <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, color: theme.t1, fontWeight: '600', fontFamily: theme.fontDisplay }}>
                Import Notes
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <XIcon size={18} color={theme.t4} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: theme.t5, lineHeight: 17 }}>
              Input transcript from Granola, Otter, Fireflies, Fathom, Zoom AI Companion, Read.ai, tl;dv, or any other meeting note tool.
            </Text>
          </View>

          {/* Scrollable body */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date + type pickers */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.t5, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                  Date
                </Text>
                <TextInputBox
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  small
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.t5, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                  Type
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {TOUCH_TYPES.map((tt) => (
                    <TouchableOpacity
                      key={tt.v}
                      onPress={() => setType(tt.v)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: type === tt.v ? tt.c + '22' : theme.bg3,
                        borderColor: type === tt.v ? tt.c : theme.brd,
                      }}
                    >
                      <Text style={{ color: type === tt.v ? tt.c : theme.t5, fontSize: 10, fontWeight: '600' }}>
                        {tt.l}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Raw paste area */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.t5, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
              Paste full transcript for best results
            </Text>
            <TextInputBox
              value={raw}
              onChangeText={setRaw}
              placeholder="Paste transcript here..."
              tall
            />

            {error ? (
              <Text style={{ color: theme.red, fontSize: 12, marginTop: 8 }}>{error}</Text>
            ) : null}

            {/* Irrelevance confirmation card */}
            {pendingIrrelevant ? (
              <View
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.warn + '60',
                  backgroundColor: theme.warn + '15',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: theme.warn,
                    marginBottom: 6,
                  }}
                >
                  Possibly off-topic
                </Text>
                <Text style={{ fontSize: 12, color: theme.t3, lineHeight: 18, marginBottom: 12 }}>
                  Are you sure this conversation is relevant to {contact?.name || 'this contact'}? Claude's summary suggests it may not be about them.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={cancelIrrelevant}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: theme.brd2,
                      backgroundColor: theme.bg,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: theme.t3, fontSize: 12, fontWeight: '600' }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmIrrelevant}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: theme.warn,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      Save anyway
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Extracted preview (only shown after extraction) */}
            {extracted ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.ac, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                  Extracted summary (edit if needed)
                </Text>
                <TextInputBox
                  value={extracted}
                  onChangeText={setExtracted}
                  placeholder="Extracted summary"
                  tall
                />
                <Text style={{ fontSize: 10, color: theme.t6, marginTop: 6, fontStyle: 'italic' }}>
                  Original transcript will be saved with this entry. Tap "View transcript" later to see it.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Pinned footer with action buttons */}
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 18,
              borderTopWidth: 1,
              borderTopColor: theme.brd,
              backgroundColor: theme.bg,
            }}
          >
            {!extracted ? (
              <TouchableOpacity
                onPress={extract}
                disabled={!raw.trim() || loading}
                style={{
                  backgroundColor: theme.ac,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: !raw.trim() || loading ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                      Extracting...
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    Extract with Claude
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={extract}
                  disabled={loading}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.brd2,
                    backgroundColor: theme.bg2,
                    alignItems: 'center',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: theme.t3, fontSize: 12, fontWeight: '600' }}>
                    Re-extract
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={save}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: theme.ac,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    Save to Log
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function TextInputBox({ value, onChangeText, placeholder, small, tall }) {
  const { theme } = useTheme();
  const { TextInput } = require('react-native');
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.t6}
      multiline={!small}
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd2,
        borderRadius: 12,
        color: theme.t1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        minHeight: small ? 38 : tall ? 140 : 60,
        textAlignVertical: 'top',
        fontFamily: theme.fontBody,
      }}
    />
  );
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