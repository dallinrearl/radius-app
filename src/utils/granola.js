// Granola Personal API client.
//
// Endpoints (per https://docs.granola.ai/introduction):
//   GET https://public-api.granola.ai/v1/notes
//   GET https://public-api.granola.ai/v1/notes/{note_id}
// Auth: Authorization: Bearer <key>
// Rate limit: 25 burst, 5/sec sustained per user.
//
// Note: API only returns notes with a generated AI summary AND transcript.
// Notes still being processed are excluded from list endpoint and 404 from get.
//
// IMPORTANT: Calls go through the `granola-proxy` Supabase Edge Function
// because Granola's API doesn't return CORS headers, which blocks
// direct browser calls. The Edge Function is also where Stage 2 cron
// will run.

import { supabase } from '../lib/supabase';

// ---------- Low-level proxy call ----------

async function granolaProxy(action, apiKey, params = {}) {
  if (!apiKey) throw new Error('No Granola API key');

  const { data, error } = await supabase.functions.invoke('granola-proxy', {
    body: { apiKey, action, params },
  });

  if (error) {
    console.error('granola-proxy invoke error:', error);
    throw new Error(error.message || 'Granola proxy call failed');
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  // The proxy returns { status, ok, body }
  if (!data?.ok) {
    if (data?.status === 401 || data?.status === 403) {
      throw new Error('Granola API key is invalid or unauthorized.');
    }
    if (data?.status === 429) {
      throw new Error('Granola rate limit hit. Try again in a minute.');
    }
    const msg =
      typeof data?.body === 'string'
        ? data.body
        : data?.body?.message || data?.body?.error || `HTTP ${data?.status}`;
    throw new Error(`Granola API error: ${msg}`);
  }

  return data.body;
}

// ---------- Public API ----------

// Quick auth check. List one note to verify the key works.
export async function testKey(apiKey) {
  try {
    await granolaProxy('test', apiKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Connection failed' };
  }
}

// List recent notes. `since` is an ISO date/datetime string for created_after.
// Pages through all results up to `maxNotes` to be safe.
export async function listRecentNotes(apiKey, { since, maxNotes = 50 } = {}) {
  const all = [];
  let cursor = null;
  let safety = 0;

  while (all.length < maxNotes && safety < 10) {
    const data = await granolaProxy('list', apiKey, {
      created_after: since || undefined,
      cursor: cursor || undefined,
      page_size: Math.min(30, maxNotes - all.length),
    });

    const notes = Array.isArray(data?.notes) ? data.notes : [];
    all.push(...notes);

    if (!data?.hasMore || !data?.cursor) break;
    cursor = data.cursor;
    safety++;
  }

  return all.slice(0, maxNotes);
}

// Fetch one note in full, including transcript.
export async function getNoteWithTranscript(apiKey, noteId) {
  if (!noteId) throw new Error('No note ID');
  return granolaProxy('get', apiKey, { note_id: noteId, include: 'transcript' });
}

// ---------- Attendee matching ----------

// Returns an object describing how each attendee maps to a Radius contact.
//
// Result shape:
//   {
//     emailMatches:  [{ attendee, contact }],     // confident matches
//     nameMatches:   [{ attendee, contact }],     // need user confirmation
//     unmatched:     [attendee],                  // no contact found
//   }
//
// "myEmails" is an array of emails belonging to the user (so we don't
// match the user against their own contacts). "myNames" is an array of
// names/display names belonging to the user — used as a backup skip when
// Granola reports the user as an attendee without an email, or with an
// email the user hasn't saved on their card.
export function matchAttendeesToContacts(attendees, contacts, myEmails = [], myNames = []) {
  const myEmailSet = new Set(
    myEmails.map((e) => (e || '').toLowerCase()).filter(Boolean),
  );
  const myNameSet = new Set(
    myNames.map((n) => normalizeName(n)).filter(Boolean),
  );

  const emailMatches = [];
  const nameMatches = [];
  const unmatched = [];
  const seenContactIds = new Set();

  for (const att of attendees || []) {
    const attEmail = (att?.email || '').trim().toLowerCase();
    const attName = (att?.name || '').trim();
    const attNameNorm = normalizeName(attName);

    // Skip the user themselves (by email OR by name)
    if (attEmail && myEmailSet.has(attEmail)) continue;
    if (attNameNorm && myNameSet.has(attNameNorm)) continue;
    // Skip blank attendees
    if (!attEmail && !attName) continue;

    // 1) Try email match first (most reliable)
    let found = null;
    if (attEmail) {
      found = findContactByEmail(contacts, attEmail);
      if (found && !seenContactIds.has(found.id)) {
        emailMatches.push({ attendee: att, contact: found });
        seenContactIds.add(found.id);
        continue;
      }
    }

    // 2) Fall back to name match (needs confirmation)
    if (attName) {
      found = findContactByName(contacts, attName);
      if (found && !seenContactIds.has(found.id)) {
        nameMatches.push({ attendee: att, contact: found });
        seenContactIds.add(found.id);
        continue;
      }
    }

    // 3) No match
    unmatched.push(att);
  }

  return { emailMatches, nameMatches, unmatched };
}

function findContactByEmail(contacts, email) {
  const target = email.toLowerCase();
  for (const c of contacts || []) {
    const emails = collectEmails(c);
    if (emails.some((e) => e.toLowerCase() === target)) {
      return c;
    }
  }
  return null;
}

function collectEmails(contact) {
  const out = [];
  if (Array.isArray(contact?.emails)) {
    for (const e of contact.emails) {
      if (e?.value) out.push(e.value);
    }
  }
  if (contact?.email) out.push(contact.email);
  return out.filter(Boolean);
}

// Name match: normalize whitespace and casing, exact match on either
// full name or "first last" reordering. Doesn't fuzzy beyond that,
// we want false positives to be rare since this triggers a confirmation prompt.
function findContactByName(contacts, name) {
  const target = normalizeName(name);
  if (!target) return null;
  for (const c of contacts || []) {
    const candidate = normalizeName(c?.name || '');
    if (candidate && candidate === target) return c;
  }
  return null;
}

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Note → raw text for AI extraction ----------
//
// We feed Claude the transcript when available (most signal), falling back
// to summary_markdown or summary_text. Includes meeting title and attendee
// list at the top so Claude has context.

export function noteToRawText(note) {
  if (!note) return '';
  const lines = [];

  if (note.title) lines.push(`Meeting: ${note.title}`);

  const start = note?.calendar_event?.scheduled_start_time;
  if (start) lines.push(`Date: ${start}`);

  if (Array.isArray(note?.attendees) && note.attendees.length > 0) {
    const att = note.attendees
      .map((a) => `${a.name || ''}${a.email ? ` <${a.email}>` : ''}`.trim())
      .filter(Boolean)
      .join(', ');
    if (att) lines.push(`Attendees: ${att}`);
  }

  lines.push('');

  if (Array.isArray(note?.transcript) && note.transcript.length > 0) {
    lines.push('--- Transcript ---');
    for (const t of note.transcript) {
      const src = t?.speaker?.source ? `[${t.speaker.source}]` : '';
      const text = (t?.text || '').trim();
      if (text) lines.push(`${src} ${text}`.trim());
    }
  } else if (note.summary_markdown) {
    lines.push('--- Summary ---');
    lines.push(note.summary_markdown);
  } else if (note.summary_text) {
    lines.push('--- Summary ---');
    lines.push(note.summary_text);
  }

  return lines.join('\n');
}

// ---------- Note → human-readable transcript only ----------
//
// Used when stashing on a convLog entry so the user can re-read what was
// actually said. Skips the metadata header (title/date/attendees) since
// that info is already on the entry. Returns an empty string if no
// transcript is available, in which case we won't show a "View transcript"
// button on the log entry.

export function noteToTranscriptText(note) {
  if (!note) return '';

  if (Array.isArray(note?.transcript) && note.transcript.length > 0) {
    const lines = [];
    for (const t of note.transcript) {
      const src = t?.speaker?.source ? `[${t.speaker.source}]` : '';
      const text = (t?.text || '').trim();
      if (text) lines.push(`${src} ${text}`.trim());
    }
    return lines.join('\n');
  }

  // No transcript available, fall back to the summary so the user still
  // has something to view. Better than an empty modal.
  if (note.summary_markdown) return note.summary_markdown;
  if (note.summary_text) return note.summary_text;

  return '';
}

// ---------- Convenience: extract scheduled date from a note ----------

export function noteDate(note) {
  const iso =
    note?.calendar_event?.scheduled_start_time ||
    note?.created_at ||
    null;
  if (!iso) return null;
  return iso.slice(0, 10); // YYYY-MM-DD
}