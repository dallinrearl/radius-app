import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { Avatar, BackButton, PrimaryButton, StyledInput } from '../components/Common';
import {
  PenIcon,
  MicIcon,
  CameraIcon,
  QrIcon,
  UsersIcon,
  CardIcon,
  ChatIcon,
  ChevronDown,
  XIcon,
} from '../components/Icons';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import { aiExtractFromVoice, aiExtractFromImage } from '../utils/ai';
import { makeVcf, isoToday } from '../utils/helpers';
import { EMPTY_CONTACT, splitLegacyName, getDisplayName } from '../constants';

export default function AddScreen({ mode, setMode, onComplete, contacts, myCard, onBack, onCommit, showToast, reviewQueue }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (mode === 'voice') return <VoiceCapture onComplete={onComplete} onBack={() => setMode(null)} />;
  if (mode === 'card') return <CardScan onComplete={onComplete} onBack={() => setMode(null)} />;
  if (mode === 'import')
    return <ImportContacts onComplete={onComplete} contacts={contacts} onCommit={onCommit} showToast={showToast} onBack={() => setMode(null)} />;
  if (mode === 'receive') return <ReceiveCard onComplete={onComplete} onBack={() => setMode(null)} />;
  if (mode === 'share') return <ShareCard myCard={myCard} onBack={() => setMode(null)} />;

  // Landing grid
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 120,
        }}
      >
        <BackButton onPress={onBack} />
        <Text
          style={{
            fontSize: 26,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 6,
            fontFamily: theme.fontDisplay,
          }}
        >
          Add Contact
        </Text>
        <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 20 }}>
          Choose how you'd like to add this person.
        </Text>

        {/* Manual entry */}
        <TouchableOpacity
          onPress={() => setMode('manual')}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.bgAc,
            borderWidth: 1,
            borderColor: theme.brdAc,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: theme.ac,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PenIcon size={20} color={theme.bg} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 15, fontWeight: '600' }}>
              Manual Input
            </Text>
            <Text style={{ color: theme.t4, fontSize: 11 }}>Type out the details yourself</Text>
          </View>
        </TouchableOpacity>

        {/* 2x2 Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
          <GridButton
            icon={<UsersIcon size={22} color={theme.info} strokeWidth={1.8} />}
            label="Import"
            sublabel="From Contacts app"
            onPress={() => setMode('import')}
          />
          <GridButton
            icon={<MicIcon size={22} color={theme.purp} strokeWidth={1.8} />}
            label="Voice Note"
            sublabel="Dictate the details"
            onPress={() => setMode('voice')}
          />
          <GridButton
            icon={<CameraIcon size={22} color={theme.warn} strokeWidth={1.8} />}
            label="Scan Card"
            sublabel="Snap a business card"
            onPress={() => setMode('card')}
          />
          <GridButton
            icon={<QrIcon size={22} color={theme.pink} strokeWidth={1.8} />}
            label="Receive E-Card"
            sublabel="Scan their QR / vCard"
            onPress={() => setMode('receive')}
          />
        </View>

        {/* From Granola */}
        <TouchableOpacity
          onPress={() => setMode('granola')}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 6,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: theme.purp + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChatIcon size={20} color={theme.purp} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600' }}>
                From Granola
              </Text>
              {Array.isArray(reviewQueue) && reviewQueue.length > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 6,
                    backgroundColor: theme.purp,
                  }}
                >
                  <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>
                    {reviewQueue.length}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>
              {Array.isArray(reviewQueue) && reviewQueue.length > 0
                ? 'Review meeting attendees waiting to be added'
                : 'Meetings will show up here after Granola syncs'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Share my card */}
        <TouchableOpacity
          onPress={() => setMode('share')}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.bg2,
            borderWidth: 1,
            borderColor: theme.brd,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: theme.bg3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CardIcon size={20} color={theme.ac} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600' }}>
              Share My E-Card
            </Text>
            <Text style={{ color: theme.t5, fontSize: 11 }}>Show your QR code to others</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function GridButton({ icon, label, sublabel, onPress }) {
  const { theme } = useTheme();
  return (
    <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 10 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: theme.bg2,
          borderWidth: 1,
          borderColor: theme.brd,
          borderRadius: 16,
          padding: 16,
          minHeight: 110,
        }}
      >
        {icon}
        <Text style={{ color: theme.t1, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
          {label}
        </Text>
        <Text style={{ color: theme.t5, fontSize: 11, marginTop: 2 }}>{sublabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Static checklist of things worth mentioning in a voice note.
const VOICE_TIP_GROUPS = [
  {
    label: 'The basics',
    items: [
      'Full name',
      'Where they work and what they do',
      'How you met (event, mutual friend, intro)',
      'Phone or email if you have it',
    ],
  },
  {
    label: 'Personal context',
    items: [
      'Where they live and where they\'re from',
      'Spouse / partner name',
      'Kids (names, ages)',
      'Hobbies or interests they mentioned',
    ],
  },
  {
    label: 'Why this contact matters',
    items: [
      'What they\'re working on or looking for',
      'Topics they care about',
      'Anything they asked you for',
      'Anything you committed to send them',
    ],
  },
];

function VoiceCapture({ onComplete, onBack }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(null);
  const [recState, setRecState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [extracting, setExtracting] = useState(false);
  // Both default closed to keep the screen clean. Users expand what they need.
  const [tipsOpen, setTipsOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  async function start() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone permission required');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(recording);
      setRecState('recording');
    } catch (e) {
      Alert.alert('Recording failed', e.message);
    }
  }

  async function stop() {
    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setRecState('done');
    } catch (e) {
      Alert.alert('Stop failed', e.message);
    }
  }

  async function processTranscript() {
    if (!transcript.trim()) return;
    setExtracting(true);
    const fields = await aiExtractFromVoice(transcript);
    setExtracting(false);

    const { touchpoint, meetingSummary, ...formFields } = fields;
    const seed = { ...EMPTY_CONTACT, ...formFields };
    seed.notes = '';

    if (touchpoint) {
      const entry = {
        id: 'voice_' + Date.now(),
        date: touchpoint.date,
        type: touchpoint.type,
        text: (meetingSummary || '').trim() || transcript.trim(),
        rawTranscript: transcript.trim(),
      };
      seed.convLog = [entry, ...(seed.convLog || [])];
      seed.lastContacted = touchpoint.date;
    } else if (transcript.trim()) {
      const entry = {
        id: 'voice_' + Date.now(),
        date: isoToday(),
        type: 'other',
        text: 'Voice memo describing this contact.',
        rawTranscript: transcript.trim(),
      };
      seed.convLog = [entry, ...(seed.convLog || [])];
    } else {
      seed.convLog = [];
    }

    onComplete(seed);
  }

  // Preview shown in the collapsed transcript header so the user knows
  // their typed content is still there.
  const transcriptPreview = transcript.trim()
    ? transcript.trim().replace(/\s+/g, ' ').slice(0, 60) +
      (transcript.trim().length > 60 ? '...' : '')
    : 'Type or paste your transcript';

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 100,
      }}
    >
      <BackButton onPress={onBack} />
      <Text
        style={{
          fontSize: 26,
          color: theme.t1,
          fontWeight: '600',
          marginBottom: 6,
          fontFamily: theme.fontDisplay,
        }}
      >
        Voice Note
      </Text>
      <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 24 }}>
        Record yourself describing the contact. The transcript is auto-parsed into fields.
      </Text>

      <View style={{ alignItems: 'center', marginVertical: 30 }}>
        <TouchableOpacity
          onPress={recState === 'recording' ? stop : start}
          activeOpacity={0.8}
          style={{
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: recState === 'recording' ? theme.red : theme.purp,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: recState === 'recording' ? theme.red : theme.purp,
            shadowOpacity: 0.5,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <MicIcon size={42} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={{ marginTop: 14, color: theme.t3, fontSize: 13, fontWeight: '500' }}>
          {recState === 'idle' && 'Tap to record'}
          {recState === 'recording' && 'Tap to stop'}
          {recState === 'done' && 'Recording complete. Type or paste your transcript below.'}
        </Text>
      </View>

      {/* Collapsible transcript section */}
      <View
        style={{
          backgroundColor: theme.bg2,
          borderWidth: 1,
          borderColor: theme.brd,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <TouchableOpacity
          onPress={() => setTranscriptOpen((o) => !o)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: theme.t4,
                letterSpacing: 0.5,
              }}
            >
              TRANSCRIPT
            </Text>
            {!transcriptOpen ? (
              <Text
                style={{
                  color: transcript.trim() ? theme.t3 : theme.t6,
                  fontSize: 12,
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {transcriptPreview}
              </Text>
            ) : null}
          </View>
          <View style={{ transform: [{ rotate: transcriptOpen ? '180deg' : '0deg' }] }}>
            <ChevronDown size={16} color={theme.t5} />
          </View>
        </TouchableOpacity>

        {transcriptOpen && (
          <View
            style={{
              paddingHorizontal: 14,
              paddingBottom: 14,
              borderTopWidth: 1,
              borderTopColor: theme.brd,
              paddingTop: 12,
            }}
          >
            <StyledInput
              value={transcript}
              onChangeText={setTranscript}
              placeholder="e.g. Met Sarah at the conference, she works at Blackstone, email schen@blackstone.com..."
              multiline
              style={{ minHeight: 140 }}
            />
            <Text style={{ color: theme.t6, fontSize: 11, marginTop: 8 }}>
              Note: real-time transcription wires up later. For now, type or paste your notes.
            </Text>
          </View>
        )}
      </View>

      <PrimaryButton
        onPress={processTranscript}
        label={extracting ? 'Extracting...' : 'Continue'}
        disabled={!transcript.trim() || extracting}
      />

      {/* What to mention: collapsible static checklist */}
      <VoiceTipsBlock
        open={tipsOpen}
        onToggle={() => setTipsOpen((o) => !o)}
        theme={theme}
      />
    </ScrollView>
  );
}

function VoiceTipsBlock({ open, onToggle, theme }) {
  return (
    <View
      style={{
        marginTop: 20,
        backgroundColor: theme.purp + '10',
        borderWidth: 1,
        borderColor: theme.purp + '35',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.purp + '25',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 14 }}>💡</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '600' }}>
            What to mention
          </Text>
          <Text style={{ color: theme.t5, fontSize: 11, marginTop: 1 }}>
            {open ? 'Tap to hide' : 'Tap to see suggestions'}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={16} color={theme.purp} />
        </View>
      </TouchableOpacity>
      {open && (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            paddingTop: 2,
            borderTopWidth: 1,
            borderTopColor: theme.purp + '25',
          }}
        >
          <Text
            style={{
              color: theme.t4,
              fontSize: 11,
              lineHeight: 16,
              marginTop: 10,
              marginBottom: 12,
              fontStyle: 'italic',
            }}
          >
            Don't worry about hitting every item. Cover whatever you know and skip the rest.
          </Text>
          {VOICE_TIP_GROUPS.map((group) => (
            <View key={group.label} style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: theme.purp,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                {group.label}
              </Text>
              {group.items.map((item) => (
                <View
                  key={item}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: theme.purp, fontSize: 12, lineHeight: 18 }}>•</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: theme.t3,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CardScan({ onComplete, onBack }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function pickCard(useCamera) {
    try {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required');
        return;
      }
      const fn = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await fn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      setBusy(true);
      const fields = await aiExtractFromImage(result.assets[0].base64);
      setBusy(false);
      onComplete({ ...EMPTY_CONTACT, ...fields });
    } catch (e) {
      setBusy(false);
      Alert.alert('Failed', e.message);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 100,
      }}
    >
      <BackButton onPress={onBack} />
      <Text
        style={{
          fontSize: 26,
          color: theme.t1,
          fontWeight: '600',
          marginBottom: 6,
          fontFamily: theme.fontDisplay,
        }}
      >
        Scan Card
      </Text>
      <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 24 }}>
        Snap a business card and let the app extract the fields.
      </Text>

      {busy && (
        <View
          style={{
            backgroundColor: theme.bg2,
            borderRadius: 14,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <ActivityIndicator color={theme.warn} />
          <Text style={{ color: theme.warn, fontSize: 13, fontWeight: '600' }}>
            Extracting card details...
          </Text>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 20 }}>
        <PrimaryButton onPress={() => pickCard(true)} label="Take Photo" />
        <TouchableOpacity
          onPress={() => pickCard(false)}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brd2,
            backgroundColor: theme.bg2,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.t2, fontSize: 14, fontWeight: '600' }}>
            Pick From Library
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={{ color: theme.t6, fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        Note: card extraction wires up to a vision model later. For now it returns blank fields.
      </Text>
    </ScrollView>
  );
}

function ImportContacts({ onComplete, contacts, onCommit, showToast, onBack }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    const perm = await Contacts.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed');
      setLoading(false);
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
    setPhoneContacts((data || []).filter((d) => d.name));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function importMulti() {
    const chosen = phoneContacts.filter((d) => selected[d.id]);
    if (!chosen.length) {
      Alert.alert('Pick at least one contact');
      return;
    }

    // Build lookup of existing contacts so we skip people already saved.
    const existingNames = new Set();
    const existingEmails = new Set();
    for (const c of contacts) {
      const dn = getDisplayName(c)?.toLowerCase().trim();
      if (dn) existingNames.add(dn);
      const emailList = Array.isArray(c.emails) ? c.emails : [];
      for (const e of emailList) {
        if (e?.value) existingEmails.add(e.value.toLowerCase().trim());
      }
      if (c.email) existingEmails.add(String(c.email).toLowerCase().trim());
    }

    let skipped = 0;
    const newOnes = chosen
      .map((d, i) => {
        const split = splitLegacyName(d.name || '');
        const phone = d.phoneNumbers?.[0]?.number || '';
        const email = d.emails?.[0]?.email || '';
        return {
          ...EMPTY_CONTACT,
          id: 'imp_' + Date.now() + '_' + i,
          firstName: split.firstName,
          lastName: split.lastName,
          company: d.company || '',
          role: d.jobTitle || '',
          phones: phone ? [{ label: 'Cell', value: phone }] : [],
          emails: email ? [{ label: 'Personal', value: email }] : [],
        };
      })
      .filter((c) => {
        const dn = getDisplayName(c)?.toLowerCase().trim();
        const em = c.emails?.[0]?.value?.toLowerCase().trim();
        if ((dn && existingNames.has(dn)) || (em && existingEmails.has(em))) {
          skipped++;
          return false;
        }
        if (dn) existingNames.add(dn);
        if (em) existingEmails.add(em);
        return true;
      });

    if (newOnes.length === 0) {
      Alert.alert(
        'Nothing new to import',
        skipped > 0
          ? `All ${skipped} selected contact${skipped === 1 ? '' : 's'} are already in Veery.`
          : 'No new contacts.',
      );
      return;
    }

    onCommit([...contacts, ...newOnes]);
    const skipText = skipped > 0 ? ` ${skipped} already in Veery, skipped.` : '';
    showToast('Imported ' + newOnes.length + ' contacts.' + skipText, theme.ac);
    onBack();
  }

  function importOne(d) {
    const split = splitLegacyName(d.name || '');
    const phone = d.phoneNumbers?.[0]?.number || '';
    const email = d.emails?.[0]?.email || '';
    const c = {
      ...EMPTY_CONTACT,
      firstName: split.firstName,
      lastName: split.lastName,
      company: d.company || '',
      role: d.jobTitle || '',
      phones: phone ? [{ label: 'Cell', value: phone }] : [],
      emails: email ? [{ label: 'Personal', value: email }] : [],
    };
    onComplete(c);
  }

  const filtered = phoneContacts.filter(
    (d) =>
      !filter ||
      d.name?.toLowerCase().includes(filter.toLowerCase()) ||
      d.company?.toLowerCase().includes(filter.toLowerCase()),
  );
  const selectCount = Object.values(selected).filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <BackButton onPress={onBack} />
        <Text
          style={{
            fontSize: 26,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 6,
            fontFamily: theme.fontDisplay,
          }}
        >
          Import Contacts
        </Text>
        <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 14 }}>
          Pick contacts from your phone. Tap a name to import that one and edit. Use checkboxes for batch.
        </Text>
        <StyledInput value={filter} onChangeText={setFilter} placeholder="Search contacts..." />
      </View>

      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator color={theme.ac} />
          <Text style={{ color: theme.t5, marginTop: 8 }}>Loading...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
          {filtered.length === 0 && (
            <Text style={{ color: theme.t6, textAlign: 'center', marginTop: 40 }}>
              No contacts found.
            </Text>
          )}
          {filtered.map((d) => {
            const sel = !!selected[d.id];
            return (
              <View
                key={d.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  marginBottom: 6,
                  backgroundColor: sel ? theme.bgAc : theme.bg2,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: sel ? theme.brdAc : theme.brd,
                }}
              >
                <TouchableOpacity onPress={() => toggle(d.id)} style={{ padding: 4 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: sel ? theme.ac : theme.brd2,
                      backgroundColor: sel ? theme.ac : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {sel && (
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <Avatar contact={{ name: d.name }} size={36} />
                <TouchableOpacity onPress={() => importOne(d)} style={{ flex: 1 }}>
                  <Text style={{ color: theme.t1, fontSize: 13, fontWeight: '600' }}>
                    {d.name}
                  </Text>
                  <Text style={{ color: theme.t5, fontSize: 11 }} numberOfLines={1}>
                    {d.company || d.jobTitle || d.phoneNumbers?.[0]?.number || ''}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {selectCount > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            left: 16,
            right: 16,
          }}
        >
          <PrimaryButton
            onPress={importMulti}
            label={'Import ' + selectCount + ' contact' + (selectCount === 1 ? '' : 's')}
          />
        </View>
      )}
    </View>
  );
}

function ReceiveCard({ onComplete, onBack }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [hasPerm, setHasPerm] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPerm(status === 'granted');
    })();
  }, []);

  function parseVcard(text) {
    const c = { ...EMPTY_CONTACT };
    const phones = [];
    const emails = [];
    let structuredName = null;
    let formattedName = '';

    function mapPhoneType(types) {
      const upper = (types || []).map((t) => t.toUpperCase());
      if (upper.includes('CELL') || upper.includes('MOBILE')) return 'Cell';
      if (upper.includes('WORK')) return 'Work';
      if (upper.includes('HOME')) return 'Home';
      return 'Other';
    }
    function mapEmailType(types) {
      const upper = (types || []).map((t) => t.toUpperCase());
      if (upper.includes('WORK')) return 'Work';
      if (upper.includes('HOME')) return 'Personal';
      return 'Personal';
    }

    text.split(/\r?\n/).forEach((line) => {
      if (!line || line.startsWith('BEGIN:') || line.startsWith('END:') || line.startsWith('VERSION:')) {
        return;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) return;
      const keyPart = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const keyTokens = keyPart.split(';');
      const key = keyTokens[0].toUpperCase();
      const params = keyTokens.slice(1);
      const types = [];
      params.forEach((p) => {
        const eq = p.indexOf('=');
        if (eq < 0) {
          types.push(p);
        } else {
          const k = p.slice(0, eq).toUpperCase();
          const v = p.slice(eq + 1);
          if (k === 'TYPE') {
            v.split(',').forEach((t) => types.push(t));
          }
        }
      });

      if (key === 'FN') {
        formattedName = value.trim();
      } else if (key === 'N') {
        const parts = value.split(';');
        structuredName = {
          lastName: (parts[0] || '').trim(),
          firstName: (parts[1] || '').trim(),
        };
      } else if (key === 'ORG') {
        c.company = value.trim();
      } else if (key === 'TITLE') {
        c.role = value.trim();
      } else if (key === 'TEL') {
        if (value.trim()) {
          phones.push({ label: mapPhoneType(types), value: value.trim() });
        }
      } else if (key === 'EMAIL') {
        if (value.trim()) {
          emails.push({ label: mapEmailType(types), value: value.trim() });
        }
      } else if (key === 'NOTE') {
        c.notes = value.trim();
      }
    });

    if (structuredName && (structuredName.firstName || structuredName.lastName)) {
      c.firstName = structuredName.firstName;
      c.lastName = structuredName.lastName;
    } else if (formattedName) {
      const split = splitLegacyName(formattedName);
      c.firstName = split.firstName;
      c.lastName = split.lastName;
    }

    c.phones = phones;
    c.emails = emails;
    return c;
  }

  function onScan({ data }) {
    if (scanned) return;
    setScanned(true);
    if (data?.startsWith('BEGIN:VCARD')) {
      onComplete(parseVcard(data));
    } else {
      Alert.alert('Not a vCard', 'The scanned QR is not in vCard format.', [
        { text: 'Try again', onPress: () => setScanned(false) },
        { text: 'Cancel', onPress: onBack, style: 'cancel' },
      ]);
    }
  }

  async function pickVcardFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      if (content.includes('BEGIN:VCARD')) {
        onComplete(parseVcard(content));
      } else {
        Alert.alert('Not a vCard');
      }
    } catch (e) {
      Alert.alert('File pick failed', e.message);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ padding: 20, paddingTop: insets.top + 12 }}>
        <BackButton onPress={onBack} />
        <Text
          style={{
            fontSize: 26,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 6,
            fontFamily: theme.fontDisplay,
          }}
        >
          Receive E-Card
        </Text>
        <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 16 }}>
          Scan a QR code that contains a vCard, or import a .vcf file.
        </Text>
      </View>

      {hasPerm === null && (
        <Text style={{ color: theme.t5, textAlign: 'center', marginTop: 40 }}>
          Requesting camera permission...
        </Text>
      )}
      {hasPerm === false && (
        <Text style={{ color: theme.red, textAlign: 'center', marginTop: 40 }}>
          Camera permission denied.
        </Text>
      )}
      {hasPerm === true && (
        <View
          style={{
            marginHorizontal: 20,
            aspectRatio: 1,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : onScan}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <View style={{ padding: 20 }}>
        <TouchableOpacity
          onPress={pickVcardFile}
          style={{
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.brd2,
            backgroundColor: theme.bg2,
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <Text style={{ color: theme.t2, fontSize: 14, fontWeight: '600' }}>
            Or pick a .vcf file
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ShareCard({ myCard, onBack }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const vcfData = makeVcf(myCard);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 100,
        alignItems: 'center',
      }}
    >
      <View style={{ alignSelf: 'flex-start', width: '100%' }}>
        <BackButton onPress={onBack} />
      </View>
      <Text
        style={{
          fontSize: 26,
          color: theme.t1,
          fontWeight: '600',
          marginBottom: 6,
          fontFamily: theme.fontDisplay,
        }}
      >
        Share My Card
      </Text>
      <Text style={{ fontSize: 13, color: theme.t5, marginBottom: 24, textAlign: 'center' }}>
        Have them scan this QR code to import your details.
      </Text>

      {!myCard.name ? (
        <View
          style={{
            backgroundColor: theme.bgWarn2,
            borderWidth: 1,
            borderColor: theme.brdWarn2,
            borderRadius: 14,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: theme.warn, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            Set up your card first
          </Text>
          <Text style={{ color: theme.t4, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            Go to Settings / My Card to add your info.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              backgroundColor: '#fff',
              padding: 20,
              borderRadius: 18,
              marginBottom: 20,
            }}
          >
            <QRCode value={vcfData} size={220} />
          </View>
          <Avatar contact={myCard} size={56} />
          <Text
            style={{
              fontSize: 16,
              color: theme.t1,
              fontWeight: '600',
              marginTop: 10,
              fontFamily: theme.fontDisplay,
            }}
          >
            {myCard.name}
          </Text>
          {(myCard.role || myCard.company) && (
            <Text style={{ fontSize: 12, color: theme.t5, marginTop: 2 }}>
              {myCard.role}
              {myCard.role && myCard.company ? ' / ' : ''}
              {myCard.company}
            </Text>
          )}
          {myCard.phone ? (
            <Text style={{ fontSize: 12, color: theme.t4, marginTop: 8 }}>{myCard.phone}</Text>
          ) : null}
          {myCard.email ? (
            <Text style={{ fontSize: 12, color: theme.t4, marginTop: 2 }}>{myCard.email}</Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}