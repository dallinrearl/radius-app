import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
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
} from '../utils/helpers';
import { FREQ, TOUCH_TYPES, TEMPLATE_TYPES } from '../constants';
import { aiBrief, aiMeetingPrep, aiBackground, aiTemplate } from '../utils/ai';
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
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!contact) return null;

  const nd = nextDate(contact.lastContacted, contact.freq);
  const ndDiff = nd ? daysUntil(nd) : null;
  const fl = FREQ.find((o) => o.v === contact.freq);

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
          {contact.phone ? (
            <QBtn label="Call" onPress={() => Linking.openURL('tel:' + contact.phone)} />
          ) : null}
          {contact.phone ? (
            <QBtn label="Text" onPress={() => Linking.openURL('sms:' + contact.phone)} />
          ) : null}
          {contact.email ? (
            <QBtn label="Email" onPress={() => Linking.openURL('mailto:' + contact.email)} />
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
        <AIPanel contact={contact} />

        {/* Details Grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginHorizontal: -7,
            marginBottom: 18,
          }}
        >
          {contact.email && (
            <DRow label="Email" value={contact.email} onPress={() => Linking.openURL('mailto:' + contact.email)} />
          )}
          {contact.phone && (
            <DRow label="Phone" value={contact.phone} onPress={() => Linking.openURL('tel:' + contact.phone)} />
          )}
          {contact.linkedin && (
            <DRow
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
          )}
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
          {contact.birthday ? <DRow label="Birthday" value={fmtDate(contact.birthday)} /> : null}
          {contact.location ? <DRow label="Location" value={contact.location} /> : null}
          {contact.timezone ? <DRow label="Timezone" value={contact.timezone} /> : null}
        </View>

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
        {(contact.experience || contact.pastCompanies?.length) && (
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
            {contact.experience && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Experience</Text>
                <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 19 }}>
                  {contact.experience}
                </Text>
              </View>
            )}
            {contact.pastCompanies?.length > 0 && (
              <View>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Past Companies</Text>
                {contact.pastCompanies.map((pc, i) => (
                  <Text key={i} style={{ fontSize: 13, color: theme.t3, marginBottom: 2 }}>
                    {pc.company}
                    {pc.role ? ' — ' + pc.role : ''}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Personal */}
        {(contact.hometown || contact.married || contact.kids?.length || contact.interests?.length) && (
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
            {contact.married ? (
              <Text
                style={{ fontSize: 13, color: theme.t3, marginBottom: 6, textTransform: 'capitalize' }}
              >
                Status: {contact.married}
                {contact.spouseName ? ' — ' + contact.spouseName : ''}
              </Text>
            ) : null}
            {contact.kids?.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 4 }}>Kids:</Text>
                {contact.kids.map((k, i) => (
                  <View key={i} style={{ marginBottom: k.notes ? 6 : 2 }}>
                    <Text style={{ fontSize: 13, color: theme.t3 }}>
                      {k.gender === 'girl' ? '(F)' : '(M)'}
                      {k.name ? ' ' + k.name : ''}
                      {k.age ? ', ' + k.age : ''}
                    </Text>
                    {k.notes ? (
                      <Text style={{ fontSize: 11, color: theme.t5, marginLeft: 24, marginTop: 1 }}>
                        {k.notes}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            {contact.interests?.length > 0 && (
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
            )}
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
          <ConvLog contact={contact} onUpdate={onUpdate} />
        </View>

        {/* Templates */}
        <Templates contact={contact} />

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

function AIPanel({ contact }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function run(type) {
    setMode(type);
    setResult('');
    setLoading(true);
    try {
      let r = '';
      if (type === 'brief') r = await aiBrief(contact);
      else if (type === 'prep') r = await aiMeetingPrep(contact);
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
        <Btn label="Brief" type="brief" color={theme.ac} bgColor={theme.bgAc} brdColor={theme.brdAc} />
        <Btn label="Meeting Prep" type="prep" color={theme.ac} bgColor={theme.bgAc} brdColor={theme.brdAc} />
        <Btn label="Background" type="background" color={theme.ac} bgColor={theme.bgAc} brdColor={theme.brdAc} />
      </View>
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
            <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 22 }}>{result}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function ConvLog({ contact, onUpdate }) {
  const { theme } = useTheme();
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [touchType, setTouchType] = useState('call');
  const log = contact.convLog || [];

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

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setAdding((a) => !a)}
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
          <View
            style={{
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd2,
              borderRadius: 12,
              padding: 10,
              marginBottom: 8,
            }}
          >
            <Text
              onPress={() => {}}
              suppressHighlighting
              style={{ color: theme.t6 }}
            />
          </View>
          {/* Use a TextInput */}
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
      {!log.length && !adding && (
        <Text style={{ fontSize: 12, color: theme.t6 }}>
          No notes yet. Tap + Add Note after a conversation.
        </Text>
      )}
      {log.map((e, i) => {
        const tt = getType(e.type);
        return (
          <View
            key={e.id}
            style={{
              borderTopWidth: i === 0 && !adding ? 0 : 1,
              borderTopColor: theme.brd,
              paddingTop: i === 0 && !adding ? 0 : 10,
              marginTop: i === 0 && !adding ? 0 : 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 10, color: tt.c, fontWeight: '600' }}>{tt.l}</Text>
                <Text style={{ fontSize: 10, color: theme.t6 }}>{fmtDate(e.date)}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  onUpdate({ ...contact, convLog: log.filter((x) => x.id !== e.id) })
                }
              >
                <XIcon size={14} color={theme.t6} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: theme.t3, lineHeight: 21 }}>{e.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TextInputBox({ value, onChangeText, placeholder }) {
  const { theme } = useTheme();
  // Lazy-load TextInput to avoid circular issues
  const { TextInput } = require('react-native');
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.t6}
      multiline
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd2,
        borderRadius: 12,
        color: theme.t1,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        minHeight: 60,
        textAlignVertical: 'top',
        fontFamily: theme.fontBody,
      }}
    />
  );
}

function Templates({ contact }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selType, setSelType] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate(type) {
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
              <Text style={{ fontSize: 13, color: theme.t2, lineHeight: 22 }}>{result}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}