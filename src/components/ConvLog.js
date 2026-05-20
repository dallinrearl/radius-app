// Shared Contact Log component. Renders a collapsible list of convLog
// entries with optional "Add Note" and "Paste Transcript" flows.
//
// Used by:
//   - DetailScreen (allowImport=true): full feature set including
//     Paste Transcript → AI extraction → save.
//   - ContactForm   (allowImport=false): manual Add Note only. Existing
//     entries (from Granola sync, etc.) still render with View Transcript.
//
// Props:
//   contact      - the contact object (must have convLog, optionally a name)
//   onUpdate     - called with the updated contact when entries change
//   showToast    - toast helper (optional)
//   consumeAiCall - AI quota gate (optional, only used when allowImport)
//   allowImport  - when true, shows the Paste Transcript button
//   displayName  - optional override for the off-topic name check
//   myCard       - the user's own card (for attribution-bug defense in AI)
//   meetingSummaryLength - user pref: 'detailed' | 'standard' | 'bullets_long' | 'bullets_short'

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '../styles/theme';
import { ChevronDown, XIcon } from './Icons';
import { fmtDate, isoToday } from '../utils/helpers';
import { TOUCH_TYPES, getDisplayName } from '../constants';
import { aiExtractMeetingNote } from '../utils/ai';

export default function ConvLog({
  contact,
  onUpdate,
  showToast,
  consumeAiCall,
  allowImport = true,
  displayName,
  myCard,
  meetingSummaryLength,
}) {
  const { theme } = useTheme();
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [touchType, setTouchType] = useState('call');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [transcriptModal, setTranscriptModal] = useState(null);
  const log = contact?.convLog || [];

  const resolvedName = displayName || getDisplayName(contact || {}) || '';

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

  function preview(text) {
    if (!text) return '';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.length > 80 ? oneLine.slice(0, 80).trim() + '...' : oneLine;
  }

  function deleteEntry(id) {
    onUpdate({ ...contact, convLog: log.filter((x) => x.id !== id) });
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginBottom: 10,
        }}
      >
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

          {allowImport && (
            <TouchableOpacity
              onPress={() => {
                setImporting(true);
                setAdding(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.brd2,
                backgroundColor: 'transparent',
                marginBottom: 10,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ color: theme.info, fontSize: 11, fontWeight: '600' }}>
                📋 Paste Transcript
              </Text>
            </TouchableOpacity>
          )}

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

      {allowImport && (
        <ImportNotesModal
          visible={importing}
          onClose={() => setImporting(false)}
          contact={contact}
          contactDisplayName={resolvedName}
          onSave={handleImportSave}
          consumeAiCall={consumeAiCall}
          myCard={myCard}
          meetingSummaryLength={meetingSummaryLength}
        />
      )}

      {log.length === 0 && !adding ? (
        <Text style={{ fontSize: 12, color: theme.t6 }}>
          {allowImport
            ? 'No notes yet. Tap + Add Note after a conversation, or paste a meeting transcript.'
            : 'No notes yet. Tap + Add Note to log a conversation.'}
        </Text>
      ) : null}

      {log.map((e, i) => {
        const tt = getType(e.type);
        const isExpanded =
          (i === 0 && !expandedIds.has(`__collapsed:${e.id}`)) || expandedIds.has(e.id);
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
              if (i === 0 && !expandedIds.has(e.id) && !expandedIds.has(`__collapsed:${e.id}`)) {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.add(`__collapsed:${e.id}`);
                  return next;
                });
                return;
              }
              if (i === 0 && expandedIds.has(`__collapsed:${e.id}`)) {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(`__collapsed:${e.id}`);
                  return next;
                });
                return;
              }
              toggleExpanded(e.id);
            }}
            onDelete={() => deleteEntry(e.id)}
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

// ----- Transcript viewer modal -----

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

// ----- Off-topic detection -----

function summaryFlagsAsIrrelevant(summary, contactDisplayName) {
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

  if (contactDisplayName && summary.length < 400) {
    const firstName = contactDisplayName.trim().split(/\s+/)[0];
    if (firstName && firstName.length >= 3) {
      const re = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!re.test(summary)) return true;
    }
  }

  return false;
}

// ----- Import Notes modal -----

function ImportNotesModal({
  visible,
  onClose,
  contact,
  contactDisplayName,
  onSave,
  consumeAiCall,
  myCard,
  meetingSummaryLength,
}) {
  const { theme } = useTheme();
  const [raw, setRaw] = useState('');
  const [extracted, setExtracted] = useState('');
  const [date, setDate] = useState(isoToday());
  const [type, setType] = useState('meeting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      // Pass myCard (for user-identity defense) and meetingSummaryLength
      // (for format/length preference) to the AI extractor.
      const result = await aiExtractMeetingNote(
        contact,
        raw,
        myCard,
        meetingSummaryLength,
      );
      if (summaryFlagsAsIrrelevant(result, contactDisplayName)) {
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
    setExtracted(pendingIrrelevant);
    setPendingIrrelevant('');
  }

  function cancelIrrelevant() {
    setPendingIrrelevant('');
    setExtracted('');
  }

  function save() {
    if (!extracted.trim()) return;
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

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
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
                  Are you sure this conversation is relevant to {contactDisplayName || 'this contact'}? Claude's summary suggests it may not be about them.
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