// Review queue utilities for Granola sync.
//
// When sync finds an attendee that doesn't have a confident email match,
// instead of silently skipping them we push a queue item so the user can
// triage later. The queue lives in app state (persisted via Supabase
// `extra.reviewQueue`) and is rendered by ReviewQueueScreen.
//
// Triage states:
//   - 'new'      = fresh from sync, default landing tab
//   - 'later'    = user tapped "Review later"
//   - 'archived' = user dismissed it. Soft-deleted, not gone, can be restored
//                  or purged from the Archive view.
//
// Items are only permanently removed from storage when the user explicitly
// purges them from the archive (or via Disconnect Granola which clears all).
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
//     triageState:      'new' | 'later' | 'archived'
//     rawTranscript:    transcript text, stashed so we don't need to re-fetch
//     rawText:          full noteToRawText, fed to aiExtractMeetingNote on confirm
//     createdAt:        ISO timestamp
//     archivedAt:       ISO timestamp, set when item moves to 'archived'
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
// New items default to triageState 'new'.
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
    triageState: 'new',
    rawTranscript: rawTranscript || '',
    rawText: rawText || '',
    createdAt: new Date().toISOString(),
    archivedAt: null,
  };
}

// Merge new items into an existing queue, deduplicating by id.
// Existing items keep their state (so a previously-archived item stays
// archived even if it re-appears in a sync).
// Backfills triageState='new' on any legacy items that lack the field.
export function mergeQueue(existing, incoming) {
  const have = new Map();
  for (const item of existing || []) {
    if (!item?.id) continue;
    const normalized = item.triageState ? item : { ...item, triageState: 'new' };
    have.set(item.id, normalized);
  }
  for (const item of incoming || []) {
    if (!item?.id) continue;
    if (!have.has(item.id)) {
      const normalized = item.triageState ? item : { ...item, triageState: 'new' };
      have.set(item.id, normalized);
    }
  }
  return Array.from(have.values());
}

// Hard-remove an item by id. Used for permanent deletion from the archive.
export function removeFromQueue(queue, itemId) {
  return (queue || []).filter((q) => q.id !== itemId);
}

// Update a queue item in place (returns a new array).
export function updateQueueItem(queue, itemId, patch) {
  return (queue || []).map((q) => (q.id === itemId ? { ...q, ...patch } : q));
}

// Split a queue into the three buckets used by the UI.
// Items without a triageState (legacy) are treated as 'new' so nothing
// vanishes during the rollout.
export function splitQueueByTriage(queue) {
  const newItems = [];
  const laterItems = [];
  const archivedItems = [];
  for (const q of queue || []) {
    const state = q?.triageState || 'new';
    if (state === 'archived') archivedItems.push(q);
    else if (state === 'later') laterItems.push(q);
    else newItems.push(q);
  }
  return { newItems, laterItems, archivedItems };
}

// Group queue items by meeting (noteId), preserving recency order.
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
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.meetingDate && !b.meetingDate) return 0;
    if (!a.meetingDate) return 1;
    if (!b.meetingDate) return -1;
    return b.meetingDate.localeCompare(a.meetingDate);
  });
}

// Return contacts whose first name matches the attendee's first name.
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