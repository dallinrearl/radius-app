import React from 'react';
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
import { FREQ, TIMEZONES } from '../constants';
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

export default function ContactForm({
  form,
  setForm,
  onSave,
  onForceSave,
  onCancel,
  title,
  flash,
  dupeWarn,
  contacts,
  allTags,
  onAddTag,
  allInterests,
  onAddInterest,
  isMyCard,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const nd = nextDate(form.lastContacted, form.freq);
  const ndDiff = nd ? daysUntil(nd) : null;

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
          <Field label="Phone">
            <StyledInput
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: fmtPhone(v) }))}
              placeholder="(801) 555-1234"
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="Email">
            <StyledInput
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
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
          <Field label="Birthday (YYYY-MM-DD)">
            <StyledInput
              value={form.birthday || ''}
              onChangeText={(v) => setForm((f) => ({ ...f, birthday: v }))}
              placeholder="2000-01-15"
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
            <Field label="Spouse's Name">
              <StyledInput
                value={form.spouseName || ''}
                onChangeText={(v) => setForm((f) => ({ ...f, spouseName: v }))}
                placeholder="e.g. Jessica"
              />
            </Field>
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

      {/* Floating Save Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          paddingBottom: 16 + insets.bottom,
          backgroundColor: theme.bg + 'F0',
        }}
      >
        <PrimaryButton onPress={onSave} label="Save Contact" />
      </View>
    </KeyboardAvoidingView>
  );
}
