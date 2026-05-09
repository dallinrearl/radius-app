import React, { useEffect } from 'react';
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
} from '../constants';
import { fmtPhone, fmtDate, nextDate, daysUntil, makeVcf } from '../utils/helpers';
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
  const nd = nextDate(form.lastContacted, form.freq);
  const ndDiff = nd ? daysUntil(nd) : null;

  // ---------- One-time form normalization on open ----------
  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      let changed = false;

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
      if (!next.id && next.addresses.length === 0) {
        next.addresses = [emptyAddress()];
        changed = true;
      }

      if (!Array.isArray(next.mailingLists)) {
        next.mailingLists = [];
        changed = true;
      }

      return changed ? next : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  const phones = Array.isArray(form.phones) ? form.phones : [];
  const emails = Array.isArray(form.emails) ? form.emails : [];
  const addresses = Array.isArray(form.addresses) ? form.addresses : [];
  const formMailingLists = Array.isArray(form.mailingLists) ? form.mailingLists : [];
  const availableLists = Array.isArray(mailingLists) ? mailingLists : [];

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

  async function exportVcf() {
    try {
      const vcf = makeVcf(form);
      const filename = (form.name || 'contact').replace(/\s+/g, '_') + '.vcf';
      const path = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(path, vcf);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/vcard' });
      }
    } catch (e) {
      Alert.alert('Export failed', e.message);
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
        <Section label="Basic Info">
          <Field label="Full Name">
            <StyledInput
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="First Last"
            />
          </Field>
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

        {/* Contact Info */}
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

          <Field label="LinkedIn">
            <StyledInput
              value={form.linkedin || ''}
              onChangeText={(v) => setForm((f) => ({ ...f, linkedin: v }))}
              placeholder="linkedin.com/in/username"
              autoCapitalize="none"
            />
          </Field>
        </Section>

        {/* Addresses */}
        <Section label="Addresses">
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
              onRemove={() => updateAddresses(addresses.filter((_, j) => j !== i))}
              onMoveUp={() => updateAddresses(moveItem(addresses, i, i - 1))}
              onMoveDown={() => updateAddresses(moveItem(addresses, i, i + 1))}
            />
          ))}
          <AddRowButton
            theme={theme}
            label={addresses.length === 0 ? '+ Add address' : '+ Add another address'}
            onPress={() => updateAddresses([...addresses, emptyAddress()])}
          />

          {addresses.length > 0 && (
            <Field label="Recipient Name (for mailing labels)">
              <StyledInput
                value={form.recipientName || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, recipientName: v }))}
                placeholder={form.name ? `Defaults to "${form.name}"` : 'e.g. The Smith Family'}
              />
            </Field>
          )}
        </Section>

        {/* Mailing Lists */}
        {!isMyCard && availableLists.length > 0 && (
          <Section label="Mailing Lists">
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
          </Section>
        )}

        {/* Context (skipped on My Card) */}
        {!isMyCard && (
          <Section label="Context">
            <Field label="How You Met">
              <StyledInput
                value={form.howMet}
                onChangeText={(v) => setForm((f) => ({ ...f, howMet: v }))}
                placeholder="e.g. ULI conference, referral from..."
              />
            </Field>
            <Field label="How I Can Help">
              <StyledInput
                value={form.howHelp || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, howHelp: v }))}
                placeholder="What value can you provide to this person?"
                multiline
              />
            </Field>
            <Field label="Last Contacted">
              <StyledInput
                value={form.lastContacted}
                onChangeText={(v) => setForm((f) => ({ ...f, lastContacted: v }))}
                placeholder="YYYY-MM-DD"
              />
            </Field>
            <Field label="Follow-up Frequency">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {FREQ.map((o) => {
                  const on = form.freq === o.v;
                  return (
                    <TouchableOpacity
                      key={o.v}
                      onPress={() => setForm((f) => ({ ...f, freq: o.v }))}
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
              </View>
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
          </Section>
        )}

        {/* Tags (skipped on My Card) */}
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

        {/* Conversation (skipped on My Card) */}
        {!isMyCard && (
          <Section label="Conversation">
            <Field label="Key Topics Discussed">
              <StyledInput
                value={form.topics}
                onChangeText={(v) => setForm((f) => ({ ...f, topics: v }))}
                placeholder="What did you talk about?"
                multiline
                style={{ minHeight: 80 }}
              />
            </Field>
            <Field label="Notes">
              <StyledInput
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Context, follow-ups, anything else..."
                multiline
                style={{ minHeight: 80 }}
              />
            </Field>
          </Section>
        )}

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
            <StyledInput
              value={form.birthday || ''}
              onChangeText={(v) => setForm((f) => ({ ...f, birthday: v }))}
              placeholder="YYYY-MM-DD or MM-DD"
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
                <StyledInput
                  value={form.anniversary || ''}
                  onChangeText={(v) => setForm((f) => ({ ...f, anniversary: v }))}
                  placeholder="YYYY-MM-DD or MM-DD"
                />
              </Field>
            </>
          )}
          <Field label="Kids">
            {(form.kids || []).map((k, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => {
                      const ks = [...form.kids];
                      ks[i] = { ...k, gender: k.gender === 'girl' ? 'boy' : 'girl' };
                      setForm((f) => ({ ...f, kids: ks }));
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.brd2,
                      backgroundColor: k.gender === 'girl' ? '#E060A018' : theme.bg2,
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
                    value={k.name}
                    onChangeText={(v) => {
                      const ks = [...form.kids];
                      ks[i] = { ...k, name: v };
                      setForm((f) => ({ ...f, kids: ks }));
                    }}
                    style={{ flex: 1 }}
                  />
                  <StyledInput
                    placeholder="Age"
                    value={k.age}
                    onChangeText={(v) => {
                      const ks = [...form.kids];
                      ks[i] = { ...k, age: v };
                      setForm((f) => ({ ...f, kids: ks }));
                    }}
                    style={{ width: 70 }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setForm((f) => ({ ...f, kids: f.kids.filter((_, j) => j !== i) }))
                    }
                  >
                    <XIcon size={18} color={theme.red} />
                  </TouchableOpacity>
                </View>
                <StyledInput
                  placeholder="Notes about this child (optional)..."
                  value={k.notes || ''}
                  onChangeText={(v) => {
                    const ks = [...form.kids];
                    ks[i] = { ...k, notes: v };
                    setForm((f) => ({ ...f, kids: ks }));
                  }}
                  multiline
                  style={{ marginTop: 6, minHeight: 40 }}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  kids: [...(f.kids || []), { name: '', age: '', gender: 'boy', notes: '' }],
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

        {/* Export */}
        {form.name?.trim() && (
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
        )}

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
              "{dupeWarn.name}"{dupeWarn.email ? ' (' + dupeWarn.email + ')' : ''} already exists.
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