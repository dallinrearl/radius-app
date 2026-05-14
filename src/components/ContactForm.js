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
import { TagSelector, InterestSelector } from './Selectors';
import { CityInput, CompanyInput } from './Typeahead';
import { DownloadIcon, XIcon } from './Icons';
import DateInput from './DateInput';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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

  // Local UI state for collapsing/expanding sections that should default closed.
  const [addressesExpanded, setAddressesExpanded] = useState(false);
  // Whether the custom one-off follow-up date picker is showing. Auto-opens
  // when the form already has a customFollowUpDate set.
  const [customDateOpen, setCustomDateOpen] = useState(false);

  // ---------- One-time form normalization on open ----------
  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      let changed = false;

      // Split legacy `name` into firstName/lastName if needed.
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

      // Rename legacy howMet -> initialIntroduction.
      if (typeof next.initialIntroduction !== 'string') {
        next.initialIntroduction = typeof next.howMet === 'string' ? next.howMet : '';
        changed = true;
      }
      if ('howMet' in next) {
        delete next.howMet;
        changed = true;
      }
      // Drop removed fields if present.
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
      // Addresses no longer auto-seed an empty one. They're hidden behind
      // an "Add an address" button now.

      if (!Array.isArray(next.mailingLists)) {
        next.mailingLists = [];
        changed = true;
      }

      // Migrate legacy birthday/anniversary strings to date objects.
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

  // Auto-expand addresses if there are any saved on this contact, and
  // auto-open the custom follow-up picker if a date is already set.
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

  // Composed display name for things like vcf export and "Defaults to ..." copy.
  const displayName = getDisplayName(form);

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

  // Pick a frequency option from the FREQ list. Stamps freqStartedAt the
  // first time so the contact appears in Next Up even without prior log
  // history. Defaults weekly to today's day of week.
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

  // Toggle the custom one-off follow-up date picker. When closing, clears
  // the saved date so we don't keep a hidden value around.
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

        {/* Basic Info — split name, company, role, then initial intro and follow-up live here too */}
        <Section label="Basic Info">
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
                  {/* Custom one-off date — sits alongside the frequency presets */}
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

                {/* Custom date picker, shown when Custom is tapped */}
                {customDateOpen && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ fontSize: 11, color: theme.t5, marginBottom: 6 }}>
                      One-off follow-up date
                    </Text>
                    <DateInput
                      value={parseLegacyDate(form.customFollowUpDate)}
                      onChange={(v) => {
                        // Re-serialize the date object back to the stored string format.
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

                {/* Day-of-week picker, shown only for weekly cadence */}
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
        </Section>

        {/* Notes — manual-only, sits high in the form */}
        {!isMyCard && (
          <Section label="Notes">
            <Field>
              <StyledInput
                value={form.notes || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Context, follow-ups, anything else..."
                multiline
                style={{ minHeight: 80 }}
              />
            </Field>
          </Section>
        )}

        {/* Contact Info — phones and emails. LinkedIn removed. */}
        <Section label="Contact Info">
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
        </Section>

        {/* Tags — directly under Contact Info per design */}
        {!isMyCard && (
          <Section label="Tags">
            <TagSelector
              tags={form.tags || []}
              allTags={allTags || []}
              onToggle={(t) =>
                setForm((f) => ({
                  ...f,
                  tags: (f.tags || []).includes(t)
                    ? f.tags.filter((x) => x !== t)
                    : [...(f.tags || []), t],
                }))
              }
              onAddTag={onAddTag}
            />
          </Section>
        )}

        {/* Addresses — hidden behind a button when empty, expanded when there are addresses */}
        <Section label="Addresses">
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
        </Section>

        {/* Background & Experience */}
        <Section label="Background & Experience">
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
        </Section>

        {/* Personal */}
        <Section label="Personal">
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
        </Section>

        {/* Mailing Lists — bottom section, includes recipient name */}
        {!isMyCard && (
          <Section label="Mailing Lists">
            {availableLists.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
                  <Text style={{ fontSize: 11, color: theme.warn, marginTop: 10, fontStyle: 'italic' }}>
                    Add an address above so this contact can be exported on the mailing label.
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, color: theme.t6 }}>
                Create a mailing list in Settings to add contacts to it.
              </Text>
            )}

            <Field label="Recipient Name (for mailing labels)">
              <StyledInput
                value={form.recipientName || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, recipientName: v }))}
                placeholder={displayName ? `Defaults to "${displayName}"` : 'e.g. The Smith Family'}
              />
            </Field>
          </Section>
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

      {/* Bottom action bar. If onSkip is provided, render Save + Skip side by side. */}
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

// =================== KidRow component ===================

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