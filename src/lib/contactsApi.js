import { supabase } from './supabase';

// Translate a contact from the database (snake_case + extra JSON)
// into the local app shape (camelCase, flat).
function fromDb(row) {
  const extra = row.extra || {};
  return {
    id: row.id,
    name: row.name || '',
    company: row.company || '',
    role: row.role || '',
    email: row.email || '',
    phone: row.phone || '',
    howMet: row.how_we_met || '',
    howHelp: row.how_i_can_help || '',
    notes: row.notes || '',
    lastContacted: row.last_contacted_at ? String(row.last_contacted_at).slice(0, 10) : '',
    tags: row.tags || [],
    freq: row.contact_frequency || 'never',
    priority: row.is_vip || false,
    photo: row.photo_url || '',
    archived: row.archived || false,
    // Fields stored inside the extra JSON blob
    linkedin: extra.linkedin || '',
    topics: extra.topics || '',
    birthday: extra.birthday || '',
    timezone: extra.timezone || '',
    location: extra.location || '',
    hometown: extra.hometown || '',
    married: extra.married ?? null,
    spouseName: extra.spouseName || '',
    kids: extra.kids || [],
    interests: extra.interests || [],
    experience: extra.experience || '',
    pastCompanies: extra.pastCompanies || [],
    convLog: extra.convLog || [],
  };
}

// Translate a contact from local app shape into the DB row shape.
function toDb(contact, userId) {
  const row = {
    user_id: userId,
    name: contact.name || '',
    company: contact.company || '',
    role: contact.role || '',
    email: contact.email || '',
    phone: contact.phone || '',
    how_we_met: contact.howMet || '',
    how_i_can_help: contact.howHelp || '',
    notes: contact.notes || '',
    last_contacted_at: contact.lastContacted || null,
    tags: contact.tags || [],
    contact_frequency: contact.freq || 'never',
    is_vip: !!contact.priority,
    photo_url: contact.photo || '',
    archived: !!contact.archived,
    extra: {
      linkedin: contact.linkedin || '',
      topics: contact.topics || '',
      birthday: contact.birthday || '',
      timezone: contact.timezone || '',
      location: contact.location || '',
      hometown: contact.hometown || '',
      married: contact.married ?? null,
      spouseName: contact.spouseName || '',
      kids: contact.kids || [],
      interests: contact.interests || [],
      experience: contact.experience || '',
      pastCompanies: contact.pastCompanies || [],
      convLog: contact.convLog || [],
    },
  };
  // Only include id if it's a real UUID (existing record)
  // Skip local sample IDs like 's1', 's2' etc.
  if (contact.id && contact.id.length > 10) {
    row.id = contact.id;
  }
  return row;
}

// Fetch all contacts for the current user
export async function fetchContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchContacts error:', error);
    return [];
  }
  return (data || []).map(fromDb);
}

// Sync a full local contacts array to Supabase.
// Figures out what to insert, update, or delete by comparing IDs.
export async function syncContacts(localContacts, userId) {
  if (!userId) return { ok: false, message: 'Not signed in' };

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
    localContacts
      .filter((c) => c.id && c.id.length > 10)
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

  // 3. Upsert all current local contacts
  const rows = localContacts.map((c) => toDb(c, userId));
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'id' });
    if (upsertErr) {
      console.error('upsert error:', upsertErr);
      return { ok: false, message: upsertErr.message };
    }
  }

  // 4. Re-fetch so caller has fresh data with real DB IDs
  const fresh = await fetchContacts();
  return { ok: true, contacts: fresh };
}