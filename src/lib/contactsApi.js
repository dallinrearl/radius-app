import { supabase } from './supabase';

// Translate a contact from the database (snake_case + extra JSON)
// into the local app shape (camelCase, flat).
//
// PHASE 4 NOTE: The contacts table no longer has `name`, `email`, `phone`,
// `how_we_met`, or `how_i_can_help` columns. They've been replaced by
// first_name / last_name / initial_introduction, and emails/phones now
// live in the `extra` jsonb as arrays (extra.emails, extra.phones).
function fromDb(row) {
  const extra = row.extra || {};
  return {
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    company: row.company || '',
    role: row.role || '',
    initialIntroduction: row.initial_introduction || '',
    notes: row.notes || '',
    lastContacted: row.last_contacted_at ? String(row.last_contacted_at).slice(0, 10) : '',
    tags: row.tags || [],
    freq: row.contact_frequency || 'never',
    priority: row.is_vip || false,
    photo: row.photo_url || '',
    archived: row.archived || false,
    // Fields stored inside the extra JSON blob.
    birthday: extra.birthday || '',
    timezone: extra.timezone || '',
    location: extra.location || '',
    hometown: extra.hometown || '',
    married: extra.married ?? null,
    spouseName: extra.spouseName || '',
    anniversary: extra.anniversary || '',
    kids: extra.kids || [],
    interests: extra.interests || [],
    experience: extra.experience || '',
    pastCompanies: extra.pastCompanies || [],
    convLog: extra.convLog || [],
    customFollowUpDate: extra.customFollowUpDate || '',
    freqStartedAt: extra.freqStartedAt || '',
    freqDayOfWeek: typeof extra.freqDayOfWeek === 'number' ? extra.freqDayOfWeek : null,
    // Multi-entry contact info + mailing list fields.
    phones: Array.isArray(extra.phones) ? extra.phones : [],
    emails: Array.isArray(extra.emails) ? extra.emails : [],
    addresses: Array.isArray(extra.addresses) ? extra.addresses : [],
    recipientName: extra.recipientName || '',
    mailingLists: Array.isArray(extra.mailingLists) ? extra.mailingLists : [],
    isSample: extra.isSample || false,
    sampleAddedAt: extra.sampleAddedAt || null,
    aiBackgroundSummary: extra.aiBackgroundSummary || '',
    aiBackgroundUpdatedAt: extra.aiBackgroundUpdatedAt || null,
    aiMeetingPrep: extra.aiMeetingPrep || '',
    aiMeetingPrepUpdatedAt: extra.aiMeetingPrepUpdatedAt || null,
  };
}

// Returns true if the given string looks like a UUID (e.g. real Supabase ID),
// not a Date.now() timestamp or short sample ID. Postgres only accepts UUIDs
// for the `id` column; sending anything else throws "invalid input syntax".
function isUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Generate a fresh v4 UUID. Used for new contacts so we always send a valid
// UUID to Supabase rather than relying on column defaults (which may or may
// not be set up). Falls back to a manual generator if crypto.randomUUID
// isn't available (older Hermes versions).
function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122-ish v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Best-effort split for any contact that still has a legacy `name` string
// but lacks firstName/lastName. Used on the way IN to the DB so we never
// send a `name` field (the column doesn't exist anymore) and never lose
// a name that the caller forgot to split.
function ensureSplitName(contact) {
  const firstName = (contact.firstName || '').trim();
  const lastName = (contact.lastName || '').trim();
  if (firstName || lastName) {
    return { firstName, lastName };
  }
  const legacy = (contact.name || '').trim();
  if (!legacy) return { firstName: '', lastName: '' };
  const idx = legacy.indexOf(' ');
  if (idx < 0) return { firstName: legacy, lastName: '' };
  return {
    firstName: legacy.slice(0, idx).trim(),
    lastName: legacy.slice(idx + 1).trim(),
  };
}

// Same for initial_introduction. Fold legacy howMet/howHelp/topics into
// initialIntroduction if the caller still has them on the contact object.
function ensureInitialIntroduction(contact) {
  const intro = (contact.initialIntroduction || '').trim();
  if (intro) return intro;
  const legacyParts = [
    (contact.howMet || '').trim(),
    (contact.howHelp || '').trim(),
    (contact.topics || '').trim(),
  ].filter(Boolean);
  return legacyParts.join(' / ');
}

// Translate a contact from local app shape into the DB row shape.
function toDb(contact, userId) {
  const { firstName, lastName } = ensureSplitName(contact);
  const initialIntroduction = ensureInitialIntroduction(contact);

  const row = {
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    company: contact.company || '',
    role: contact.role || '',
    initial_introduction: initialIntroduction,
    notes: contact.notes || '',
    last_contacted_at: contact.lastContacted || null,
    tags: contact.tags || [],
    contact_frequency: contact.freq || 'never',
    is_vip: !!contact.priority,
    photo_url: contact.photo || '',
    archived: !!contact.archived,
    extra: {
      birthday: contact.birthday || '',
      timezone: contact.timezone || '',
      location: contact.location || '',
      hometown: contact.hometown || '',
      married: contact.married ?? null,
      spouseName: contact.spouseName || '',
      anniversary: contact.anniversary || '',
      kids: contact.kids || [],
      interests: contact.interests || [],
      experience: contact.experience || '',
      pastCompanies: contact.pastCompanies || [],
      convLog: contact.convLog || [],
      customFollowUpDate: contact.customFollowUpDate || '',
      freqStartedAt: contact.freqStartedAt || '',
      freqDayOfWeek:
        typeof contact.freqDayOfWeek === 'number' ? contact.freqDayOfWeek : null,
      phones: Array.isArray(contact.phones) ? contact.phones : [],
      emails: Array.isArray(contact.emails) ? contact.emails : [],
      addresses: Array.isArray(contact.addresses) ? contact.addresses : [],
      recipientName: contact.recipientName || '',
      mailingLists: Array.isArray(contact.mailingLists) ? contact.mailingLists : [],
      isSample: !!contact.isSample,
      sampleAddedAt: contact.sampleAddedAt || null,
      aiBackgroundSummary: contact.aiBackgroundSummary || '',
      aiBackgroundUpdatedAt: contact.aiBackgroundUpdatedAt || null,
      aiMeetingPrep: contact.aiMeetingPrep || '',
      aiMeetingPrepUpdatedAt: contact.aiMeetingPrepUpdatedAt || null,
    },
  };
  // Always include id. If the contact has a real UUID already, use it (so
  // upsert updates the existing row). If not, generate a fresh UUID — that
  // way we send a valid id to Postgres regardless of column defaults.
  // Skips local sample IDs ('s1') and legacy timestamp IDs (Date.now())
  // by detecting them via isUuid and replacing rather than passing through.
  if (isUuid(contact.id)) {
    row.id = contact.id;
  } else {
    row.id = generateUuid();
  }
  return row;
}

// Fetch all contacts for the current user.
// Throws on error so callers can distinguish "user has zero contacts"
// (returns []) from "fetch failed" (throws).
export async function fetchContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchContacts error:', error);
    throw new Error(error.message || 'Failed to fetch contacts');
  }
  return (data || []).map(fromDb);
}

// Returns true if a contact is a "sample" — local-only, never synced to
// Supabase. Sample IDs start with 'sample_' (per constants.js getSampleContacts).
// We also fence on isSample as a belt-and-suspenders check.
function isSampleContact(c) {
  return !!(c && (c.isSample || (typeof c.id === 'string' && c.id.startsWith('sample_'))));
}

// Sync a full local contacts array to Supabase.
// Figures out what to insert, update, or delete by comparing IDs.
export async function syncContacts(localContacts, userId) {
  if (!userId) return { ok: false, message: 'Not signed in' };

  // Split out sample contacts. Samples are local-only — never written to
  // or read from Supabase. Without this fence we'd assign them fresh
  // UUIDs every save, piling up duplicate cloud rows AND breaking
  // archive/delete (the post-sync re-fetch would replace our local
  // state with the cloud rows we shouldn't have created in the first place).
  const samples = localContacts.filter(isSampleContact);
  const real = localContacts.filter((c) => !isSampleContact(c));

  // 1. Get current cloud contact IDs so we know what to delete
  const { data: existing, error: fetchErr } = await supabase
    .from('contacts')
    .select('id');
  if (fetchErr) {
    console.error('syncContacts fetch error:', fetchErr);
    return { ok: false, message: fetchErr.message };
  }
  const cloudIds = new Set((existing || []).map((r) => r.id));
  const localIds = new Set(
    real
      .filter((c) => isUuid(c.id))
      .map((c) => c.id),
  );

  // 2. Delete contacts that exist in cloud but not locally
  const toDelete = [...cloudIds].filter((id) => !localIds.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('contacts')
      .delete()
      .in('id', toDelete);
    if (delErr) console.error('delete error:', delErr);
  }

  // 3. Upsert real contacts (samples skipped). toDb assigns a fresh UUID
  // to any contact without one, so all rows have a valid id.
  const rows = real.map((c) => toDb(c, userId));
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) {
      console.error('upsert error:', upsertErr);
      return { ok: false, message: upsertErr.message };
    }
  }

  // 4. Re-fetch real contacts and merge samples back in. Without this
  // merge, the post-sync state-set in useAppStore would drop samples.
  try {
    const fresh = await fetchContacts();
    return { ok: true, contacts: [...samples, ...fresh] };
  } catch (e) {
    // Sync wrote successfully but post-fetch failed. Surface as soft error.
    console.warn('syncContacts post-fetch failed:', e?.message);
    return { ok: true, contacts: null };
  }
}