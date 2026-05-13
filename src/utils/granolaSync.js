// granolaSync.js
//
// Standalone Granola sync logic, extracted from SettingsScreen so it can be
// invoked from anywhere — currently used by:
//   - SettingsScreen → user-triggered "Sync Now" button (with progress UI)
//   - App.js → silent background sync on app launch (throttled)
//
// The function is pure-ish: it takes everything it needs as args, calls
// onProgress(text) for status updates, and returns a result summary.
// Storage I/O for processed-IDs and last-sync timestamps stays here so
// callers don't have to coordinate.

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

// Run a Granola sync. Returns a result object describing what happened.
// Throws on hard failure (proxy down, auth invalid, etc.) — caller should
// catch and present.
//
// args:
//   apiKey:           Granola API key (already validated)
//   contacts:         current contacts array
//   myCard:           user's card (for self-skipping)
//   onProgress:       optional (statusText) => void for UI updates
//   onCommit:         (updatedContacts) => void, called with new contacts array
//   addToReviewQueue: (items) => Promise<void>, called with new queue items
//
// returns:
//   {
//     ok: true,
//     appendedCount: number,    // log entries added via email match
//     queuedCount: number,      // items pushed to review queue
//     hadAnything: boolean,     // any new note found at all
//     summary: string,          // human-readable summary
//   }
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

  // Build "since": last sync minus 1 day for safety, or 30 days back if first sync
  const lastSync = await AsyncStorage.getItem(GRANOLA_LAST_SYNC_STORAGE);
  const since = lastSync
    ? new Date(new Date(lastSync).getTime() - 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const processedRaw = await AsyncStorage.getItem(GRANOLA_PROCESSED_IDS_STORAGE);
  const processed = new Set(processedRaw ? JSON.parse(processedRaw) : []);

  progress('Fetching recent meetings...');

  // 1) List recent notes
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

  // Self-skip: collect user's emails + names so they don't end up in the queue
  const myEmails = [];
  if (myCard?.email) myEmails.push(myCard.email);
  if (Array.isArray(myCard?.emails)) {
    for (const e of myCard.emails) if (e?.value) myEmails.push(e.value);
  }
  const myNames = [];
  if (myCard?.name) myNames.push(myCard.name);
  if (myCard?.displayName) myNames.push(myCard.displayName);

  // 2) Process each note
  let updated = [...contacts];
  let appendedCount = 0;
  let queuedNameOnlyCount = 0;
  let queuedUnmatchedCount = 0;
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

    const matches = matchAttendeesToContacts(full.attendees, updated, myEmails, myNames);

    const date = noteDate(full) || isoToday();
    const rawText = noteToRawText(full);
    const transcriptText = noteToTranscriptText(full);
    const meetingTitle = full?.title || 'Untitled meeting';

    // 2a) Auto-save email matches
    for (const { contact } of matches.emailMatches) {
      try {
        // Free users: save the raw Granola note as-is (no Claude extraction).
        // Pro users: run Claude to extract a contact-targeted note.
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

    // 2b) Queue name-only matches
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

    // 2c) Queue unmatched attendees
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

    newProcessed.add(note.id);
  }

  // 3) Commit, push to queue, persist
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

  // 4) Build summary
  const queuedTotal = queuedNameOnlyCount + queuedUnmatchedCount;
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