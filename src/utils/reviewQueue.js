// Review queue utilities for Granola sync.
//
// When sync finds an attendee that doesn't have a confident email match,
// instead of silently skipping them we push a queue item so the user can
// triage later. The queue lives in app state (persisted via Supabase
// `extra.reviewQueue`) and is rendered by ReviewQueueScreen.
//
// Item shape:
//   {
//     id:               unique, stable across syncs (so we don't double-queue)
//     noteId:           Granola note ID
//     meetingTitle:     human-readable title
//     meetingDate:      'YYYY-MM-DD'
//     attendee:         { name, email }
//     suggestion:       { contactId, reason } | null
//     status:           'pending' (only kind we render)
//     rawTranscript:    transcript text, stashed so we don't need to re-fetch
//     rawText:          full noteToRawText, fed to aiExtractMeetingNote on confirm
//     createdAt:        ISO timestamp
//   }

// Build a stable queue-item ID. Same noteId + same attendee key always
// produces the same ID, so re-syncing a meeting can't enqueue duplicates.
export function buildQueueItemId(noteId, attendee) {
  const key = (attendee?.email || attendee?.name || 'unknown')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_');
  return `rq_${noteId}_${key}`;
}

// Construct a queue item from sync context. Used by SettingsScreen sync flow.
export function makeQueueItem({
  noteId,
  meetingTitle,
  meetingDate,
  attendee,
  suggestion = null,
  rawTranscript = '',
  rawText = '',
}) {
  return {
    id: buildQueueItemId(noteId, attendee),
    noteId,
    meetingTitle: meetingTitle || 'Untitled meeting',
    meetingDate: meetingDate || '',
    attendee: {
      name: attendee?.name || '',
      email: attendee?.email || '',
    },
    suggestion: suggestion
      ? {
          contactId: suggestion.contactId || null,
          reason: suggestion.reason || 'Suggested',
        }
      : null,
    status: 'pending',
    rawTranscript: rawTranscript || '',
    rawText: rawText || '',
    createdAt: new Date().toISOString(),
  };
}

// Merge new items into an existing queue, deduplicating by id.
// New items don't overwrite existing ones (existing user choices win).
export function mergeQueue(existing, incoming) {
  const have = new Map();
  for (const item of existing || []) {
    if (item?.id) have.set(item.id, item);
  }
  for (const item of incoming || []) {
    if (!item?.id) continue;
    if (!have.has(item.id)) {
      have.set(item.id, item);
    }
  }
  return Array.from(have.values());
}

// Remove a queue item by id.
export function removeFromQueue(queue, itemId) {
  return (queue || []).filter((q) => q.id !== itemId);
}

// Update a queue item in place (returns a new array).
export function updateQueueItem(queue, itemId, patch) {
  return (queue || []).map((q) => (q.id === itemId ? { ...q, ...patch } : q));
}

// Group queue items by meeting (noteId), preserving recency order. Useful
// for rendering a tidy list grouped by call.
export function groupByMeeting(queue) {
  const groups = new Map();
  for (const item of queue || []) {
    if (!groups.has(item.noteId)) {
      groups.set(item.noteId, {
        noteId: item.noteId,
        meetingTitle: item.meetingTitle,
        meetingDate: item.meetingDate,
        items: [],
      });
    }
    groups.get(item.noteId).items.push(item);
  }
  // Sort groups by date descending (newest first), undated last
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.meetingDate && !b.meetingDate) return 0;
    if (!a.meetingDate) return 1;
    if (!b.meetingDate) return -1;
    return b.meetingDate.localeCompare(a.meetingDate);
  });
}

// Return contacts whose first name matches the attendee's first name (case
// insensitive, exact match on first token). Used for the "same first name"
// quick-filter when a queue item has no suggestion.
export function findContactsByFirstName(attendeeName, contacts) {
  if (!attendeeName) return [];
  const first = attendeeName.trim().split(/\s+/)[0];
  if (!first || first.length < 2) return [];
  const target = first.toLowerCase();
  return (contacts || []).filter((c) => {
    if (!c?.name) return false;
    const cFirst = c.name.trim().split(/\s+/)[0];
    return cFirst && cFirst.toLowerCase() === target;
  });
}