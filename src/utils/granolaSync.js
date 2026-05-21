// granolaSync.js
//
// Standalone Granola sync logic, extracted from SettingsScreen so it can be
// invoked from anywhere — currently used by:
//   - SettingsScreen → user-triggered "Sync Now" button (with progress UI)
//   - App.js → silent background sync on app launch (throttled)
//
// Behavior:
//   - When Granola returns one or more attendees besides the user, we use
//     them. Email-matched contacts get auto-saved log entries; name-only
//     matches and unmatched attendees go to the review queue.
//   - When Granola returns ONLY the user as an attendee (or no attendees
//     at all), we still queue the meeting — but as a single "no-name"
//     queue item with an empty attendee. The ReviewQueueScreen then offers
//     AI extraction (Pro) or manual review of the transcript to the user
//     so they can identify and add the contact themselves.
//   - We NEVER queue the user as an attendee.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listRecentNotes,
  getNoteWithTranscript,
  matchAttendeesToContacts,
  noteToRawText,
  noteToTranscriptText,
  noteDate,
} from './granola';
import { makeQueueItem } from './reviewQueue';
import { aiExtractMeetingNote } from './ai';
import { isoToday } from './helpers';

const GRANOLA_LAST_SYNC_STORAGE = 'crm-granola-last-sync';
const GRANOLA_PROCESSED_IDS_STORAGE = 'crm-granola-processed-ids';

// Count "real" attendees in a note (everyone except the user).
// Returns 0 when Granola reports only the user, or no attendees at all.
function countNonUserAttendees(attendees, myEmails, myNames) {
  if (!Array.isArray(attendees)) return 0;
  const myEmailSet = new Set(
    myEmails.map((e) => (e || '').toLowerCase()).filter(Boolean),
  );
  const myNameSet = new Set(
    myNames.map((n) => (n || '').toLowerCase().trim()).filter(Boolean),
  );
  let count = 0;
  for (const a of attendees) {
    const email = (a?.email || '').toLowerCase().trim();
    const name = (a?.name || '').toLowerCase().trim();
    if (email && myEmailSet.has(email)) continue;
    if (name && myNameSet.has(name)) continue;
    if (!email && !name) continue;
    count++;
  }
  return count;
}

// Run a Granola sync. Returns a result object describing what happened.
export async function runGranolaSync({
  apiKey,
  contacts,
  myCard,
  onProgress,
  onCommit,
  addToReviewQueue,
  granolaAiUnlocked = true,
}) {
  if (!apiKey) {
    throw new Error('No Granola API key');
  }

  const progress = (msg) => {
    if (typeof onProgress === 'function') onProgress(msg);
  };

  const lastSync = await AsyncStorage.getItem(GRANOLA_LAST_SYNC_STORAGE);
  const since = lastSync
    ? new Date(new Date(lastSync).getTime() - 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const processedRaw = await AsyncStorage.getItem(GRANOLA_PROCESSED_IDS_STORAGE);
  const processed = new Set(processedRaw ? JSON.parse(processedRaw) : []);

  progress('Fetching recent meetings...');

  const notes = await listRecentNotes(apiKey, { since, maxNotes: 30 });

  if (notes.length === 0) {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(GRANOLA_LAST_SYNC_STORAGE, now);
    return {
      ok: true,
      appendedCount: 0,
      queuedCount: 0,
      hadAnything: false,
      summary: 'No new meetings found.',
    };
  }

  const unprocessed = notes.filter((n) => !processed.has(n.id));
  if (unprocessed.length === 0) {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(GRANOLA_LAST_SYNC_STORAGE, now);
    return {
      ok: true,
      appendedCount: 0,
      queuedCount: 0,
      hadAnything: false,
      summary: 'All recent meetings already synced.',
    };
  }

  // Build user-identity sets once for the whole sync run.
  const myEmails = [];
  if (myCard?.email) myEmails.push(myCard.email);
  if (Array.isArray(myCard?.emails)) {
    for (const e of myCard.emails) if (e?.value) myEmails.push(e.value);
  }
  const myNames = [];
  if (myCard?.name) myNames.push(myCard.name);
  if (myCard?.displayName) myNames.push(myCard.displayName);

  let updated = [...contacts];
  let appendedCount = 0;
  let queuedNameOnlyCount = 0;
  let queuedUnmatchedCount = 0;
  let queuedNoNameCount = 0;
  const newQueueItems = [];
  const newProcessed = new Set(processed);

  for (let i = 0; i < unprocessed.length; i++) {
    const note = unprocessed[i];
    progress(`Processing meeting ${i + 1} of ${unprocessed.length}...`);

    let full;
    try {
      full = await getNoteWithTranscript(apiKey, note.id);
    } catch (e) {
      console.warn('Skipping note', note.id, e.message);
      continue;
    }

    const date = noteDate(full) || isoToday();
    const rawText = noteToRawText(full);
    const transcriptText = noteToTranscriptText(full);
    const meetingTitle = full?.title || 'Untitled meeting';

    const nonUserCount = countNonUserAttendees(full?.attendees, myEmails, myNames);

    if (nonUserCount > 0) {
      // Normal path: Granola provided non-user attendees. Use them.
      const matches = matchAttendeesToContacts(
        full.attendees,
        updated,
        myEmails,
        myNames,
      );

      // Auto-save email matches
      for (const { contact } of matches.emailMatches) {
        try {
          const extracted = granolaAiUnlocked
            ? await aiExtractMeetingNote(contact, rawText, myCard)
            : (rawText || '').trim() || meetingTitle;
          const entry = {
            id: 'granola_' + note.id + '_' + contact.id,
            date,
            text: extracted,
            type: 'meeting',
            source: 'granola',
            source_id: note.id,
          };
          if (transcriptText && transcriptText.trim()) {
            entry.rawTranscript = transcriptText;
          }
          updated = updated.map((c) => {
            if (c.id !== contact.id) return c;
            const log = Array.isArray(c.convLog) ? c.convLog : [];
            if (log.some((e) => e.id === entry.id)) return c;
            return {
              ...c,
              convLog: [entry, ...log],
              lastContacted: date > (c.lastContacted || '') ? date : c.lastContacted,
            };
          });
          appendedCount++;
        } catch (e) {
          console.warn('Extraction failed for note', note.id, 'contact', contact.id, e.message);
        }
      }

      // Queue name-only matches
      for (const { attendee, contact } of matches.nameMatches) {
        newQueueItems.push(
          makeQueueItem({
            noteId: note.id,
            meetingTitle,
            meetingDate: date,
            attendee,
            suggestion: { contactId: contact.id, reason: 'Name match' },
            rawTranscript: transcriptText,
            rawText,
          }),
        );
        queuedNameOnlyCount++;
      }

      // Queue unmatched attendees
      for (const attendee of matches.unmatched) {
        newQueueItems.push(
          makeQueueItem({
            noteId: note.id,
            meetingTitle,
            meetingDate: date,
            attendee,
            suggestion: null,
            rawTranscript: transcriptText,
            rawText,
          }),
        );
        queuedUnmatchedCount++;
      }
    } else {
      // No-name path: Granola only returned the user (or no attendees at all).
      // Queue a single placeholder item for the meeting with empty attendee
      // info. The ReviewQueueScreen renders these with a "no attendee name"
      // flag and offers AI extraction or manual review.
      newQueueItems.push(
        makeQueueItem({
          noteId: note.id,
          meetingTitle,
          meetingDate: date,
          attendee: { name: '', email: '' },
          suggestion: null,
          rawTranscript: transcriptText,
          rawText,
        }),
      );
      queuedNoNameCount++;
    }

    newProcessed.add(note.id);
  }

  if (typeof onCommit === 'function') {
    onCommit(updated);
  }
  if (newQueueItems.length > 0 && typeof addToReviewQueue === 'function') {
    await addToReviewQueue(newQueueItems);
  }
  await AsyncStorage.setItem(
    GRANOLA_PROCESSED_IDS_STORAGE,
    JSON.stringify(Array.from(newProcessed)),
  );
  const now = new Date().toISOString();
  await AsyncStorage.setItem(GRANOLA_LAST_SYNC_STORAGE, now);

  const queuedTotal =
    queuedNameOnlyCount + queuedUnmatchedCount + queuedNoNameCount;
  const parts = [];
  if (appendedCount > 0) {
    parts.push(`${appendedCount} log ${appendedCount === 1 ? 'entry' : 'entries'} added`);
  }
  if (queuedTotal > 0) {
    parts.push(`${queuedTotal} to review`);
  }
  const summary = parts.length > 0 ? parts.join(', ') : 'Nothing to add';

  return {
    ok: true,
    appendedCount,
    queuedCount: queuedTotal,
    hadAnything: appendedCount > 0 || queuedTotal > 0,
    summary,
  };
}

// Should the app run a silent background sync right now? Returns true if:
//   - last sync was more than `minMinutes` ago (default 30)
//   - or there's no record of a previous sync at all
export async function shouldRunBackgroundSync(minMinutes = 30) {
  try {
    const last = await AsyncStorage.getItem(GRANOLA_LAST_SYNC_STORAGE);
    if (!last) return true;
    const lastMs = new Date(last).getTime();
    if (!Number.isFinite(lastMs)) return true;
    const ageMin = (Date.now() - lastMs) / (60 * 1000);
    return ageMin >= minMinutes;
  } catch (_) {
    return true;
  }
}