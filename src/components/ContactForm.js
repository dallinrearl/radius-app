import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import {
  FREQ,
  TIMEZONES,
  PHONE_LABELS,
  EMAIL_LABELS,
  ADDRESS_LABELS,
  emptyPhone,
  emptyEmail,
  emptyAddress,
  getDisplayName,
  TAG_GROUPS,
  TAG_COLORS,
  CUSTOM_TAG_COLORS,
  getTagLabel,
} from '../constants';
import {
  fmtPhone,
  fmtDate,
  nextDate,
  daysUntil,
  makeVcf,
  parseLegacyDate,
  dateObjectIsEmpty,
  isoToday,
  DAYS_OF_WEEK,
  dowOf,
} from '../utils/helpers';
import {
  Section,
  Field,
  StyledInput,
  PrimaryButton,
  Toggle,
  BackButton,
} from './Common';
import { InterestSelector } from './Selectors';
import { CityInput, CompanyInput } from './Typeahead';
import { DownloadIcon, XIcon } from './Icons';
import DateInput from './DateInput';
import ConvLog from './ConvLog';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function colorForTag(v) {
  if (!v) return '#888';
  if (TAG_COLORS[v]) return TAG_COLORS[v];
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  return CUSTOM_TAG_COLORS[h % CUSTOM_TAG_COLORS.length];
}

export default function ContactForm({
  form,
  setForm,
  onSave,
  onForceSave,
  onCancel,
  onSkip,
  title,
  flash,
  dupeWarn,
  contacts,
  allTags,
  onAddTag,
  allInterests,
  onAddInterest,
  mailingLists,
  isMyCard,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const nd = nextDate(form.lastContacted, form.freq, form.freqStartedAt, form.freqDayOfWeek);
  const ndDiff = nd ? daysUntil(nd) : null;

  const [addressesExpanded, setAddressesExpanded] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState('');

  // ---------- One-time form normalization on open ----------
  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      let changed = false;

      if (typeof next.firstName !== 'string') {
        next.firstName = '';
        changed = true;
      }
      if (typeof next.lastName !== 'string') {
        next.lastName = '';
        changed = true;
      }
      if (!next.firstName && !next.lastName && typeof next.name === 'string' && next.name.trim()) {
        const trimmed = next.name.trim();
        const idx = trimmed.indexOf(' ');
        if (idx < 0) {
          next.firstName = trimmed;
        } else {
          next.firstName = trimmed.slice(0, idx);
          next.lastName = trimmed.slice(idx + 1).trim();
        }
        changed = true;
      }

      if (typeof next.initialIntroduction !== 'string') {
        next.initialIntroduction = typeof next.howMet === 'string' ? next.howMet : '';
        changed = true;
      }
      if ('howMet' in next) {
        delete next.howMet;
        changed = true;
      }
      if ('howHelp' in next) {
        delete next.howHelp;
        changed = true;
      }
      if ('topics' in next) {
        delete next.topics;
        changed = true;
      }
      if ('linkedin' in next) {
        delete next.linkedin;
        changed = true;
      }

      if (typeof next.customFollowUpDate !== 'string') {
        next.customFollowUpDate = '';
        changed = true;
      }
      if (typeof next.notes !== 'string') {
        next.notes = '';
        changed = true;
      }
      if (!Array.isArray(next.convLog)) {
        next.convLog = [];
        changed = true;
      }

      if (!Array.isArray(next.phones)) {
        next.phones = [];
        changed = true;
      }
      if (next.phones.length === 0) {
        if (typeof next.phone === 'string' && next.phone.trim()) {
          next.phones = [{ label: 'Cell', value: next.phone.trim() }];
        } else {
          next.phones = [emptyPhone()];
        }
        changed = true;
      }

      if (!Array.isArray(next.emails)) {
        next.emails = [];
        changed = true;
      }
      if (next.emails.length === 0) {
        if (typeof next.email === 'string' && next.email.trim()) {
          next.emails = [{ label: 'Personal', value: next.email.trim() }];
        } else {
          next.emails = [emptyEmail()];
        }
        changed = true;
      }

      if (!Array.isArray(next.addresses)) {
        next.addresses = [];
        changed = true;
      }

      if (!Array.isArray(next.mailingLists)) {
        next.mailingLists = [];
        changed = true;
      }

      if (typeof next.birthday === 'string') {
        next.birthday = parseLegacyDate(next.birthday);
        changed = true;
      }
      if (typeof next.anniversary === 'string') {
        next.anniversary = parseLegacyDate(next.anniversary);
        changed = true;
      }

      return changed ? next : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  useEffect(() => {
    if (Array.isArray(form.addresses) && form.addresses.length > 0) {
      setAddressesExpanded(true);
    }
    if (form.customFollowUpDate) {
      setCustomDateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  const phones = Array.isArray(form.phones) ? form.phones : [];
  const emails = Array.isArray(form.emails) ? form.emails : [];
  const addresses = Array.isArray(form.addresses) ? form.addresses : [];
  const formMailingLists = Array.isArray(form.mailingLists) ? form.mailingLists : [];
  const availableLists = Array.isArray(mailingLists) ? mailingLists : [];

  const displayName = getDisplayName(form);

  // Lookup sets for "is this a built-in tag?". We check both values
  // ('investor') and display labels ('Investor', 'Family Office') because
  // `allTags` from the store may contain either depending on how it was
  // populated. Anything that matches a built-in by value OR by label is
  // considered built-in and stays out of the Custom section.
  const builtInTagValues = TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.v));
  const builtInTagValuesSet = new Set(builtInTagValues);
  const builtInTagLabelsSet = new Set(
    TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.l)),
  );
  function isBuiltInTag(v) {
    if (!v) return false;
    return builtInTagValuesSet.has(v) || builtInTagLabelsSet.has(v);
  }

  const selectedTags = Array.isArray(form.tags) ? form.tags : [];
  const customSelectedTags = selectedTags.filter((t) => !isBuiltInTag(t));
  const knownCustomTags = (allTags || []).filter(
    (t) => !isBuiltInTag(t) && !customSelectedTags.includes(t),
  );

  // Which subsection groups are expanded. Default: all collapsed.
  // Selected chips live above the groups so users can see what they
  // picked without expanding anything.
  const [expandedTagGroups, setExpandedTagGroups] = useState(() => ({}));
  function toggleTagGroup(key) {
    setExpandedTagGroups((g) => ({ ...g, [key]: !g[key] }));
  }
  const [customExpanded, setCustomExpanded] = useState(false);

  // Per-section "has data" flags. CollapsibleSection uses these as the
  // initial open/closed state. Basic Info is always expanded because it
  // anchors the form and the user needs to see name/company first.
  const hasContactLogData = Array.isArray(form.convLog) && form.convLog.length > 0;
  const hasNotesData = !!(form.notes && form.notes.trim());
  const hasContactInfoData =
    (Array.isArray(form.phones) && form.phones.some((p) => p && p.value && p.value.trim())) ||
    (Array.isArray(form.emails) && form.emails.some((e) => e && e.value && e.value.trim()));
  const hasTagsData = Array.isArray(form.tags) && form.tags.length > 0;
  const hasAddressesData = Array.isArray(form.addresses) && form.addresses.length > 0;
  const hasBackgroundData =
    !!(form.experience && form.experience.trim()) ||
    (Array.isArray(form.pastCompanies) &&
      form.pastCompanies.some((pc) => (pc && pc.company && pc.company.trim()) || (pc && pc.role && pc.role.trim())));
  const hasPersonalData =
    !!form.hometown ||
    !!form.location ||
    !!form.timezone ||
    !!form.married ||
    !!form.spouseName ||
    (form.birthday && !dateObjectIsEmpty(form.birthday)) ||
    (form.anniversary && !dateObjectIsEmpty(form.anniversary)) ||
    (Array.isArray(form.kids) && form.kids.length > 0) ||
    (Array.isArray(form.interests) && form.interests.length > 0);
  const hasMailingListsData =
    (Array.isArray(form.mailingLists) && form.mailingLists.length > 0) ||
    !!(form.recipientName && form.recipientName.trim());

  function toggleTag(v) {
    setForm((f) => ({
      ...f,
      tags: (f.tags || []).includes(v)
        ? (f.tags || []).filter((x) => x !== v)
        : [...(f.tags || []), v],
    }));
  }

  function addNewCustomTag() {
    const v = (newTagDraft || '').trim();
    if (!v) return;
    setNewTagDraft('');
    if (onAddTag) onAddTag(v);
    setForm((f) => ({
      ...f,
      tags: (f.tags || []).includes(v) ? f.tags : [...(f.tags || []), v],
    }));
  }

  function updatePhones(next) {
    setForm((f) => ({
      ...f,
      phones: next,
      phone: next[0]?.value || '',
    }));
  }
  function updateEmails(next) {
    setForm((f) => ({
      ...f,
      emails: next,
      email: next[0]?.value || '',
    }));
  }
  function updateAddresses(next) {
    setForm((f) => ({ ...f, addresses: next }));
  }
  function toggleMailingList(listId) {
    setForm((f) => {
      const current = Array.isArray(f.mailingLists) ? f.mailingLists : [];
      const next = current.includes(listId)
        ? current.filter((x) => x !== listId)
        : [...current, listId];
      return { ...f, mailingLists: next };
    });
  }

  function addFirstAddress() {
    updateAddresses([emptyAddress()]);
    setAddressesExpanded(true);
  }

  // Bridge ConvLog's onUpdate (expects a full contact-shaped object back)
  // into setForm. ConvLog calls onUpdate({ ...contact, convLog, lastContacted })
  // so we just replace the relevant fields on the form.
  function applyConvLogUpdate(updatedContact) {
    setForm((f) => ({
      ...f,
      convLog: updatedContact.convLog || [],
      lastContacted:
        typeof updatedContact.lastContacted === 'string'
          ? updatedContact.lastContacted
          : f.lastContacted,
    }));
  }

  async function exportVcf() {
    try {
      const vcf = makeVcf(form);
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

  function pickFreq(v) {
    setForm((f) => {
      const next = { ...f, freq: v };
      if (v && v !== 'never') {
        if (!f.freqStartedAt) next.freqStartedAt = isoToday();
        if (v === '1week' && f.freqDayOfWeek == null) {
          next.freqDayOfWeek = new Date().getDay();
        }
      } else {
        next.freqStartedAt = '';
        next.freqDayOfWeek = null;
      }
      return next;
    });
  }

  function toggleCustomDate() {
    if (customDateOpen) {
      setForm((f) => ({ ...f, customFollowUpDate: '' }));
      setCustomDateOpen(false);
    } else {
      setCustomDateOpen(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 140,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton onPress={onCancel} />
        <Text
          style={{
            fontSize: 20,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 20,
            fontFamily: theme.fontDisplay,
          }}
        >
          {title}
        </Text>

        {flash && (
          <View
            style={{
              backgroundColor: theme.bgAc,
              borderWidth: 1,
              borderColor: theme.brdAc,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>
              Fields auto-filled from capture
            </Text>
          </View>
        )}

        {/* Basic Info */}
        <CollapsibleSection label="Basic Info" hasData={true}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="First Name">
                <StyledInput
                  value={form.firstName || ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
                  placeholder="First"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Last Name">
                <StyledInput
                  value={form.lastName || ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
                  placeholder="Last"
                />
              </Field>
            </View>
          </View>
          <Field label="Company">
            <CompanyInput
              value={form.company}
              onChange={(v) => setForm((f) => ({ ...f, company: v }))}
              contacts={contacts}
            />
          </Field>
          <Field label="Job Title / Role">
            <StyledInput
              value={form.role}
              onChangeText={(v) => setForm((f) => ({ ...f, role: v }))}
              placeholder="e.g. VP of Acquisitions"
            />
          </Field>

          {!isMyCard && (
            <>
              <Field label="Initial Introduction">
                <StyledInput
                  value={form.initialIntroduction || ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, initialIntroduction: v }))}
                  placeholder="e.g. ULI conference, referral from..."
                />
              </Field>

              <Field label="Follow up">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {FREQ.map((o) => {
                    const on = form.freq === o.v;
                    return (
                      <TouchableOpacity
                        key={o.v}
                        onPress={() => pickFreq(o.v)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                          borderWidth: 1,
                          backgroundColor: on ? theme.bgAc : theme.bg2,
                          borderColor: on ? theme.ac : theme.brd2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: on ? theme.ac : theme.t5,
                            fontWeight: '600',
                          }}
                        >
                          {o.l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={toggleCustomDate}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor: customDateOpen ? theme.bgAc : theme.bg2,
                      borderColor: customDateOpen ? theme.ac : theme.brd2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: customDateOpen ? theme.ac : theme.t5,
                        fontWeight: '600',
                      }}
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {customDateOpen && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 6 }}>
                      One-off follow-up date
                    </Text>
                    <DateInput
                      value={parseLegacyDate(form.customFollowUpDate)}
                      onChange={(v) => {
                        if (!v || dateObjectIsEmpty(v)) {
                          setForm((f) => ({ ...f, customFollowUpDate: '' }));
                          return;
                        }
                        const mm = v.month != null ? String(v.month).padStart(2, '0') : '';
                        const dd = v.day != null ? String(v.day).padStart(2, '0') : '';
                        const yyyy = v.year != null ? String(v.year) : '';
                        if (mm && dd && yyyy) {
                          setForm((f) => ({ ...f, customFollowUpDate: `${yyyy}-${mm}-${dd}` }));
                        } else if (mm && dd) {
                          setForm((f) => ({ ...f, customFollowUpDate: `${mm}-${dd}` }));
                        } else {
                          setForm((f) => ({ ...f, customFollowUpDate: '' }));
                        }
                      }}
                      requireYear
                    />
                  </View>
                )}

                {form.freq === '1week' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {DAYS_OF_WEEK.map((d) => {
                      const on = form.freqDayOfWeek === d.v;
                      return (
                        <TouchableOpacity
                          key={d.v}
                          onPress={() => setForm((f) => ({ ...f, freqDayOfWeek: d.v }))}
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
                )}
              </Field>

              {nd && (
                <Text
                  style={{
                    fontSize: 12,
                    color: ndDiff < 0 ? theme.red : ndDiff <= 7 ? theme.warn : theme.ac,
                    marginTop: -8,
                    marginBottom: 12,
                  }}
                >
                  Next contact: {fmtDate(nd)} (
                  {ndDiff < 0 ? Math.abs(ndDiff) + 'd overdue' : ndDiff + 'd from now'})
                </Text>
              )}
            </>
          )}

          {!isMyCard && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 8,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: theme.t4,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  VIP Contact
                </Text>
                <Text style={{ fontSize: 10, color: theme.t6, marginTop: 2 }}>
                  Prioritize in your network
                </Text>
              </View>
              <Toggle
                value={!!form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                color={theme.warn}
              />
            </View>
          )}
        </CollapsibleSection>

        {/* Contact Log — manual entries + any pre-seeded entries (Granola etc.).
            Paste-Transcript disabled here (allowImport=false) since the
            primary route into the form's log is the Granola sync flow. */}
        {!isMyCard && (
          <CollapsibleSection
            label="Contact Log"
            hasData={hasContactLogData}
            badge={hasContactLogData ? form.convLog.length : null}
          >
            <ConvLog
              contact={form}
              onUpdate={applyConvLogUpdate}
              allowImport={false}
              displayName={displayName}
            />
          </CollapsibleSection>
        )}

        {/* Notes — manual user input only. AI never writes here. */}
        {!isMyCard && (
          <CollapsibleSection label="Notes" hasData={hasNotesData}>
            <Field>
              <StyledInput
                value={form.notes || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Context, follow-ups, anything else..."
                multiline
                style={{ minHeight: 80 }}
              />
            </Field>
          </CollapsibleSection>
        )}

        {/* Contact Info */}
        <CollapsibleSection label="Contact Info" hasData={hasContactInfoData}>
          <Field label="Phones">
            {phones.map((p, i) => (
              <PhoneRow
                key={`phone-${i}`}
                theme={theme}
                phone={p}
                index={i}
                count={phones.length}
                onChange={(next) => {
                  const arr = [...phones];
                  arr[i] = next;
                  updatePhones(arr);
                }}
                onRemove={() => updatePhones(phones.filter((_, j) => j !== i))}
                onMoveUp={() => updatePhones(moveItem(phones, i, i - 1))}
                onMoveDown={() => updatePhones(moveItem(phones, i, i + 1))}
              />
            ))}
            <AddRowButton
              theme={theme}
              label="+ Add another phone"
              onPress={() => updatePhones([...phones, emptyPhone()])}
            />
          </Field>

          <Field label="Emails">
            {emails.map((e, i) => (
              <EmailRow
                key={`email-${i}`}
                theme={theme}
                email={e}
                index={i}
                count={emails.length}
                onChange={(next) => {
                  const arr = [...emails];
                  arr[i] = next;
                  updateEmails(arr);
                }}
                onRemove={() => updateEmails(emails.filter((_, j) => j !== i))}
                onMoveUp={() => updateEmails(moveItem(emails, i, i - 1))}
                onMoveDown={() => updateEmails(moveItem(emails, i, i + 1))}
              />
            ))}
            <AddRowButton
              theme={theme}
              label="+ Add another email"
              onPress={() => updateEmails([...emails, emptyEmail()])}
            />
          </Field>
        </CollapsibleSection>

        {/* Tags */}
        {!isMyCard && (
          <CollapsibleSection
            label="Tags"
            hasData={hasTagsData}
            badge={hasTagsData ? selectedTags.length : null}
          >
            {/* Selected — pinned chips at the top of the Tags section.
                Tap a chip to remove. Hidden if nothing is selected. */}
            {selectedTags.length > 0 && (
              <View
                style={{
                  marginBottom: 14,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.brd,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: theme.ac,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Selected
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {selectedTags.map((v) => {
                    const c = colorForTag(v);
                    return (
                      <TouchableOpacity
                        key={`sel-${v}`}
                        onPress={() => toggleTag(v)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 20,
                          borderWidth: 1,
                          backgroundColor: c + '22',
                          borderColor: c,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: c, fontWeight: '600' }}>
                          {getTagLabel(v)}
                        </Text>
                        <XIcon size={11} color={c} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Built-in group subsections. Collapsed by default. */}
            {TAG_GROUPS.map((group, gIdx) => {
              const open = !!expandedTagGroups[group.key];
              const selectedInGroup = group.tags.filter((t) =>
                selectedTags.includes(t.v),
              ).length;
              return (
                <View
                  key={group.key}
                  style={{ marginBottom: gIdx === TAG_GROUPS.length - 1 ? 4 : 10 }}
                >
                  <TouchableOpacity
                    onPress={() => toggleTagGroup(group.key)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
                    }}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: theme.t4,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {group.label}
                      </Text>
                      {selectedInGroup > 0 && (
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                            borderRadius: 6,
                            backgroundColor: theme.bgAc,
                            borderWidth: 1,
                            borderColor: theme.brdAc,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              color: theme.ac,
                              fontWeight: '700',
                            }}
                          >
                            {selectedInGroup}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{ fontSize: 11, color: theme.t5, fontWeight: '600' }}
                    >
                      {open ? '▾' : '▸'}
                    </Text>
                  </TouchableOpacity>
                  {open && (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 6,
                      }}
                    >
                      {group.tags.map((t) => {
                        const on = selectedTags.includes(t.v);
                        const c = colorForTag(t.v);
                        return (
                          <TouchableOpacity
                            key={t.v}
                            onPress={() => toggleTag(t.v)}
                            activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 20,
                              borderWidth: 1,
                              backgroundColor: on ? c + '22' : 'transparent',
                              borderColor: on ? c : theme.brd2,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: on ? c : theme.t4,
                                fontWeight: '600',
                              }}
                            >
                              {t.l}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Custom subsection. Only shows if there ARE custom tags
                (truly custom, not display-label collisions with built-ins).
                Collapsible like the others. */}
            {(customSelectedTags.length > 0 || knownCustomTags.length > 0) && (
              <View style={{ marginTop: 4, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => setCustomExpanded((v) => !v)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: theme.t4,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      Custom
                    </Text>
                    {customSelectedTags.length > 0 && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 6,
                          backgroundColor: theme.bgAc,
                          borderWidth: 1,
                          borderColor: theme.brdAc,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            color: theme.ac,
                            fontWeight: '700',
                          }}
                        >
                          {customSelectedTags.length}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{ fontSize: 11, color: theme.t5, fontWeight: '600' }}
                  >
                    {customExpanded ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
                {customExpanded && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    {[...customSelectedTags, ...knownCustomTags].map((v) => {
                      const on = selectedTags.includes(v);
                      const c = colorForTag(v);
                      return (
                        <TouchableOpacity
                          key={v}
                          onPress={() => toggleTag(v)}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 20,
                            borderWidth: 1,
                            backgroundColor: on ? c + '22' : 'transparent',
                            borderColor: on ? c : theme.brd2,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: on ? c : theme.t4,
                              fontWeight: '600',
                            }}
                          >
                            {getTagLabel(v)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <StyledInput
                  value={newTagDraft}
                  onChangeText={setNewTagDraft}
                  placeholder="Add a custom tag..."
                  onSubmitEditing={addNewCustomTag}
                />
              </View>
              <TouchableOpacity
                onPress={addNewCustomTag}
                disabled={!newTagDraft.trim()}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                  backgroundColor: theme.bgAc,
                  opacity: newTagDraft.trim() ? 1 : 0.5,
                }}
              >
                <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </CollapsibleSection>
        )}

        {/* Background */}
        <CollapsibleSection label="Background & Experience" hasData={hasBackgroundData}>
          <Field label="Experience Details">
            <StyledInput
              value={form.experience || ''}
              onChangeText={(v) => setForm((f) => ({ ...f, experience: v }))}
              placeholder="Notable experience, education, achievements..."
              multiline
            />
          </Field>
          <Field label="Past Companies">
            {(form.pastCompanies || []).map((pc, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <StyledInput
                  value={pc.company}
                  onChangeText={(v) => {
                    const pcs = [...form.pastCompanies];
                    pcs[i] = { ...pc, company: v };
                    setForm((f) => ({ ...f, pastCompanies: pcs }));
                  }}
                  placeholder="Company"
                  style={{ flex: 1 }}
                />
                <StyledInput
                  value={pc.role || ''}
                  onChangeText={(v) => {
                    const pcs = [...form.pastCompanies];
                    pcs[i] = { ...pc, role: v };
                    setForm((f) => ({ ...f, pastCompanies: pcs }));
                  }}
                  placeholder="Role"
                  style={{ flex: 1 }}
                />
                <TouchableOpacity
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      pastCompanies: f.pastCompanies.filter((_, j) => j !== i),
                    }))
                  }
                  style={{ padding: 4 }}
                >
                  <XIcon size={18} color={theme.red} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  pastCompanies: [...(f.pastCompanies || []), { company: '', role: '' }],
                }))
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.brd2,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ color: theme.info, fontSize: 12, fontWeight: '500' }}>
                + Add past company
              </Text>
            </TouchableOpacity>
          </Field>
        </CollapsibleSection>

        {/* Personal */}
        <CollapsibleSection label="Personal" hasData={hasPersonalData}>
          <Field label="Hometown">
            <CityInput
              value={form.hometown}
              onChange={(v) => setForm((f) => ({ ...f, hometown: v }))}
            />
          </Field>
          <Field label="Current Location">
            <StyledInput
              value={form.location || ''}
              onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
              placeholder="e.g. New York, NY"
            />
          </Field>
          <Field label="Timezone">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TIMEZONES.map((tz) => {
                const on = (form.timezone || '') === tz.v;
                return (
                  <TouchableOpacity
                    key={tz.v || 'none'}
                    onPress={() => setForm((f) => ({ ...f, timezone: tz.v }))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      borderWidth: 1,
                      backgroundColor: on ? theme.bgAc : theme.bg2,
                      borderColor: on ? theme.ac : theme.brd2,
                    }}
                  >
                    <Text
                      style={{ fontSize: 10, color: on ? theme.ac : theme.t5, fontWeight: '600' }}
                    >
                      {tz.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
          <Field label="Birthday">
            <DateInput
              value={form.birthday}
              onChange={(v) => setForm((f) => ({ ...f, birthday: dateObjectIsEmpty(v) ? null : v }))}
            />
          </Field>
          <Field label="Marital Status">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['married', 'single', 'divorced', 'widowed'].map((v) => {
                const on = form.married === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() =>
                      setForm((f) => ({ ...f, married: f.married === v ? null : v }))
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      alignItems: 'center',
                      backgroundColor: on ? '#7B5EEA18' : theme.bg2,
                      borderColor: on ? theme.purp : theme.brd2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: on ? theme.purp : theme.t5,
                        textTransform: 'capitalize',
                      }}
                    >
                      {v}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
          {form.married === 'married' && (
            <>
              <Field label="Spouse's Name">
                <StyledInput
                  value={form.spouseName || ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, spouseName: v }))}
                  placeholder="e.g. Jessica"
                />
              </Field>
              <Field label="Anniversary">
                <DateInput
                  value={form.anniversary}
                  onChange={(v) => setForm((f) => ({ ...f, anniversary: dateObjectIsEmpty(v) ? null : v }))}
                />
              </Field>
            </>
          )}
          <Field label="Kids">
            {(form.kids || []).map((k, i) => (
              <KidRow
                key={i}
                kid={k}
                theme={theme}
                onChange={(next) => {
                  const ks = [...form.kids];
                  ks[i] = next;
                  setForm((f) => ({ ...f, kids: ks }));
                }}
                onRemove={() =>
                  setForm((f) => ({ ...f, kids: f.kids.filter((_, j) => j !== i) }))
                }
              />
            ))}
            <TouchableOpacity
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  kids: [
                    ...(f.kids || []),
                    {
                      name: '',
                      gender: 'boy',
                      notes: '',
                      birthday: null,
                      ageAsOf: null,
                      ageMode: 'age',
                      age: '',
                    },
                  ],
                }))
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.brd2,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ color: theme.purp, fontSize: 12, fontWeight: '500' }}>+ Add child</Text>
            </TouchableOpacity>
          </Field>
          <Field label="Interests">
            <InterestSelector
              interests={form.interests || []}
              allInterests={allInterests || []}
              onToggle={(t) =>
                setForm((f) => ({
                  ...f,
                  interests: (f.interests || []).includes(t)
                    ? f.interests.filter((x) => x !== t)
                    : [...(f.interests || []), t],
                }))
              }
              onAddInterest={onAddInterest}
            />
          </Field>
        </CollapsibleSection>

        {/* Addresses */}
        <CollapsibleSection label="Addresses" hasData={hasAddressesData}>
          {addresses.length === 0 && !addressesExpanded ? (
            <AddRowButton
              theme={theme}
              label="+ Add an address"
              onPress={addFirstAddress}
            />
          ) : (
            <>
              {addresses.map((a, i) => (
                <AddressRow
                  key={`addr-${i}`}
                  theme={theme}
                  address={a}
                  index={i}
                  count={addresses.length}
                  onChange={(next) => {
                    const arr = [...addresses];
                    arr[i] = next;
                    updateAddresses(arr);
                  }}
                  onRemove={() => {
                    const next = addresses.filter((_, j) => j !== i);
                    updateAddresses(next);
                    if (next.length === 0) setAddressesExpanded(false);
                  }}
                  onMoveUp={() => updateAddresses(moveItem(addresses, i, i - 1))}
                  onMoveDown={() => updateAddresses(moveItem(addresses, i, i + 1))}
                />
              ))}
              <AddRowButton
                theme={theme}
                label="+ Add another address"
                onPress={() => updateAddresses([...addresses, emptyAddress()])}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Mailing Lists */}
        {!isMyCard && (
          <CollapsibleSection label="Mailing Lists" hasData={hasMailingListsData}>
            {availableLists.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {availableLists.map((list) => {
                    const on = formMailingLists.includes(list.id);
                    return (
                      <TouchableOpacity
                        key={list.id}
                        onPress={() => toggleMailingList(list.id)}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          backgroundColor: on ? theme.bgAc : theme.bg2,
                          borderColor: on ? theme.ac : theme.brd2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: on ? theme.ac : theme.t4,
                            fontWeight: '600',
                          }}
                        >
                          {list.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {addresses.length === 0 && formMailingLists.length > 0 && (
                  <Text style={{ fontSize: 11, color: theme.warn, marginTop: 8, fontStyle: 'italic' }}>
                    Add an address above so this contact can be exported on the mailing label.
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, color: theme.t6 }}>
                Create a mailing list in Settings to add contacts to it.
              </Text>
            )}

            <View style={{ marginTop: 14 }}>
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
                Recipient Name (for mailing labels)
              </Text>
              <StyledInput
                value={form.recipientName || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, recipientName: v }))}
                placeholder={displayName ? `Defaults to "${displayName}"` : 'e.g. The Smith Family'}
              />
            </View>
          </CollapsibleSection>
        )}

        {/* Export */}
        {displayName ? (
          <TouchableOpacity
            onPress={exportVcf}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.brd2,
              backgroundColor: theme.bg2,
              marginBottom: 8,
            }}
          >
            <DownloadIcon size={16} color={theme.ac} strokeWidth={2} />
            <Text style={{ color: theme.ac, fontSize: 13, fontWeight: '500' }}>
              Export to Contacts (.vcf)
            </Text>
          </TouchableOpacity>
        ) : null}

        {dupeWarn && (
          <View
            style={{
              backgroundColor: theme.bgWarn2,
              borderWidth: 1,
              borderColor: theme.brdWarn2,
              borderRadius: 14,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: theme.warn, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
              Possible duplicate found
            </Text>
            <Text style={{ color: theme.t3, fontSize: 12, marginBottom: 10 }}>
              "{getDisplayName(dupeWarn)}"{dupeWarn.email ? ' (' + dupeWarn.email + ')' : ''} already exists.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={onForceSave}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.warn,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.warn, fontSize: 12, fontWeight: '600' }}>
                  Save Anyway
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          paddingBottom: 16 + insets.bottom,
          backgroundColor: theme.bg + 'F0',
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <View style={{ flex: onSkip ? 2 : 1 }}>
          <PrimaryButton onPress={onSave} label="Save Contact" />
        </View>
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.brd2,
              backgroundColor: theme.bg2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.t4, fontSize: 14, fontWeight: '600' }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// =================== KidRow ===================

function KidRow({ kid, theme, onChange, onRemove }) {
  const k = kid || {};
  const hasBirthday =
    k.birthday && (typeof k.birthday === 'object' ? !dateObjectIsEmpty(k.birthday) : !!k.birthday);
  const ageMode = k.ageMode || (hasBirthday ? 'birthday' : 'age');

  function setMode(mode) {
    onChange({ ...k, ageMode: mode });
  }

  function setAgeStr(v) {
    const cleaned = (v || '').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    const asOfRecord =
      Number.isFinite(num) && cleaned !== ''
        ? { age: num, asOf: isoToday() }
        : null;
    onChange({ ...k, age: cleaned, ageAsOf: asOfRecord });
  }

  function setBirthday(next) {
    const empty = dateObjectIsEmpty(next);
    onChange({ ...k, birthday: empty ? null : next });
  }

  return (
    <View
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brd2,
        backgroundColor: theme.bg2,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => onChange({ ...k, gender: k.gender === 'girl' ? 'boy' : 'girl' })}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.brd2,
            backgroundColor: k.gender === 'girl' ? '#E060A018' : theme.bg3,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: k.gender === 'girl' ? theme.pink : theme.t5,
            }}
          >
            {k.gender === 'girl' ? 'Girl' : 'Boy'}
          </Text>
        </TouchableOpacity>
        <StyledInput
          placeholder="Name"
          value={k.name || ''}
          onChangeText={(v) => onChange({ ...k, name: v })}
          style={{ flex: 1 }}
        />
        <TouchableOpacity onPress={onRemove}>
          <XIcon size={18} color={theme.red} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 8 }}>
        <ModeBtn
          theme={theme}
          on={ageMode === 'age'}
          label="Age"
          onPress={() => setMode('age')}
        />
        <ModeBtn
          theme={theme}
          on={ageMode === 'birthday'}
          label="Birthday"
          onPress={() => setMode('birthday')}
        />
      </View>

      {ageMode === 'age' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StyledInput
            placeholder="e.g. 2.5"
            value={k.age || ''}
            onChangeText={setAgeStr}
            style={{ width: 100 }}
            keyboardType="decimal-pad"
          />
          <Text style={{ fontSize: 11, color: theme.t6, flex: 1 }}>
            Auto-increments over time
          </Text>
        </View>
      ) : (
        <DateInput value={k.birthday} onChange={setBirthday} compact />
      )}

      <StyledInput
        placeholder="Notes about this child (optional)..."
        value={k.notes || ''}
        onChangeText={(v) => onChange({ ...k, notes: v })}
        multiline
        style={{ marginTop: 8, minHeight: 40 }}
      />
    </View>
  );
}

function ModeBtn({ theme, on, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: on ? theme.bgAc : theme.bg3,
        borderColor: on ? theme.ac : theme.brd2,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: on ? theme.ac : theme.t5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =================== Sub-components ===================

function LabelPicker({ theme, value, presets, onChange }) {
  const isPresetMatch = presets.includes(value);
  const showCustomInput = !isPresetMatch || value === 'Other';

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {presets.map((p) => {
          const on = value === p || (!isPresetMatch && p === 'Other');
          return (
            <TouchableOpacity
              key={p}
              onPress={() => onChange(p === 'Other' ? '' : p)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: on ? theme.bgAc : theme.bg2,
                borderColor: on ? theme.ac : theme.brd2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: on ? theme.ac : theme.t5,
                  fontWeight: '600',
                }}
              >
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {showCustomInput && (
        <View style={{ marginTop: 8 }}>
          <StyledInput
            value={isPresetMatch ? '' : value}
            onChangeText={onChange}
            placeholder="Custom label (e.g. Beach House)"
          />
        </View>
      )}
    </View>
  );
}

function RowControls({ theme, index, count, onMoveUp, onMoveDown, onRemove }) {
  const upDisabled = index === 0;
  const downDisabled = index === count - 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}>
      <TouchableOpacity
        onPress={onMoveUp}
        disabled={upDisabled}
        style={{
          opacity: upDisabled ? 0.3 : 1,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: theme.t4, fontSize: 14 }}>▲</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onMoveDown}
        disabled={downDisabled}
        style={{
          opacity: downDisabled ? 0.3 : 1,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: theme.t4, fontSize: 14 }}>▼</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
        <XIcon size={18} color={theme.red} />
      </TouchableOpacity>
    </View>
  );
}

function AddRowButton({ theme, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.brd2,
        alignSelf: 'flex-start',
        marginTop: 4,
      }}
    >
      <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function PhoneRow({ theme, phone, index, count, onChange, onRemove, onMoveUp, onMoveDown }) {
  const isPrimary = index === 0 && count > 1;
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brd2,
        backgroundColor: theme.bg2,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <LabelPicker
            theme={theme}
            value={phone.label || ''}
            presets={PHONE_LABELS}
            onChange={(v) => onChange({ ...phone, label: v })}
          />
        </View>
        <RowControls
          theme={theme}
          index={index}
          count={count}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <StyledInput
          value={phone.value || ''}
          onChangeText={(v) => onChange({ ...phone, value: fmtPhone(v) })}
          placeholder="(801) 555-1234"
          keyboardType="phone-pad"
        />
      </View>
      {isPrimary && (
        <Text style={{ fontSize: 10, color: theme.t5, marginTop: 6 }}>Primary</Text>
      )}
    </View>
  );
}

function EmailRow({ theme, email, index, count, onChange, onRemove, onMoveUp, onMoveDown }) {
  const isPrimary = index === 0 && count > 1;
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brd2,
        backgroundColor: theme.bg2,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <LabelPicker
            theme={theme}
            value={email.label || ''}
            presets={EMAIL_LABELS}
            onChange={(v) => onChange({ ...email, label: v })}
          />
        </View>
        <RowControls
          theme={theme}
          index={index}
          count={count}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <StyledInput
          value={email.value || ''}
          onChangeText={(v) => onChange({ ...email, value: v })}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      {isPrimary && (
        <Text style={{ fontSize: 10, color: theme.t5, marginTop: 6 }}>Primary</Text>
      )}
    </View>
  );
}

function AddressRow({ theme, address, index, count, onChange, onRemove, onMoveUp, onMoveDown }) {
  const isPrimary = index === 0 && count > 1;
  const update = (k, v) => onChange({ ...address, [k]: v });
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.brd2,
        backgroundColor: theme.bg2,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <LabelPicker
            theme={theme}
            value={address.label || ''}
            presets={ADDRESS_LABELS}
            onChange={(v) => update('label', v)}
          />
        </View>
        <RowControls
          theme={theme}
          index={index}
          count={count}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
      </View>
      <View style={{ marginTop: 8, gap: 8 }}>
        <StyledInput
          value={address.line1 || ''}
          onChangeText={(v) => update('line1', v)}
          placeholder="Address line 1"
        />
        <StyledInput
          value={address.line2 || ''}
          onChangeText={(v) => update('line2', v)}
          placeholder="Address line 2 (apt, suite, etc.)"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StyledInput
            value={address.city || ''}
            onChangeText={(v) => update('city', v)}
            placeholder="City"
            style={{ flex: 2 }}
          />
          <StyledInput
            value={address.state || ''}
            onChangeText={(v) => update('state', v)}
            placeholder="State"
            style={{ flex: 1 }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StyledInput
            value={address.zip || ''}
            onChangeText={(v) => update('zip', v)}
            placeholder="ZIP"
            style={{ flex: 1 }}
          />
          <StyledInput
            value={address.country || ''}
            onChangeText={(v) => update('country', v)}
            placeholder="Country"
            style={{ flex: 2 }}
          />
        </View>
      </View>
      {isPrimary && (
        <Text style={{ fontSize: 10, color: theme.t5, marginTop: 6 }}>Primary</Text>
      )}
    </View>
  );
}

// Collapsible section wrapper. Smart default: expand if `hasData` is true,
// collapse if empty. User can toggle either way.
function CollapsibleSection({ label, hasData, badge, children }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(!!hasData);

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.brd,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: theme.t4,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
          {badge ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 6,
                backgroundColor: theme.bgAc,
                borderWidth: 1,
                borderColor: theme.brdAc,
              }}
            >
              <Text style={{ fontSize: 9, color: theme.ac, fontWeight: '700' }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 11, color: theme.t5, fontWeight: '600' }}>
          {open ? '▾' : '▸'}
        </Text>
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 }}>
          {children}
        </View>
      )}
    </View>
  );
}