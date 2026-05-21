// supabase/functions/send-notifications/index.ts
//
// Daily push-notification sender for Veery.
//
// Runs on a schedule (via pg_cron, see setup SQL). For every user who:
//   - has notifications_enabled = true
//   - has a real expo_push_token (not the 'dev-no-device' placeholder)
// it scans their contacts and builds a notification covering:
//   - overdue follow-ups (if notif_overdue)        -> count of overdue contacts
//   - birthdays / anniversaries today (if notif_birthdays)
// Then sends a single batched push per user via the Expo Push API.
//
// Timezone: each user has a `timezone` (IANA). We only send when it's the
// chosen send-hour (default 9) in that user's local time. Because we run
// the cron hourly, each user gets picked up in the hour that matches 9am
// locally. This avoids 3am pings for people in other timezones.
//
// Deploy:  supabase functions deploy send-notifications --no-verify-jwt
// Secrets needed (already present in Supabase by default):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SEND_HOUR_LOCAL = 9; // 9am in the user's local timezone

// FREQ day counts, mirrored from src/constants FREQ[].d
const FREQ_DAYS: Record<string, number> = {
  '1week': 7,
  '2weeks': 14,
  '1month': 30,
  '3months': 90,
  '6months': 180,
  annual: 365,
};

// ---- date helpers (server-side mirror of src/utils/helpers.js) ----

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoFromDate(d);
}

// next scheduled contact date, mirroring nextDate() in the app
function nextDate(
  lastContacted: string | null,
  freq: string | null,
  freqStartedAt: string | null,
  preferredDayOfWeek: number | null,
  todayIso: string,
): string | null {
  if (!freq || freq === 'never') return null;
  const days = FREQ_DAYS[freq];
  if (!days) return null;

  const anchor = lastContacted || freqStartedAt || todayIso;
  let candidate = addDays(anchor, days);

  if (freq === '1week' && preferredDayOfWeek != null) {
    const d = new Date(candidate + 'T12:00:00Z');
    const currentDow = d.getUTCDay();
    let delta = preferredDayOfWeek - currentDow;
    if (delta < 0) delta += 7;
    if (delta > 0) candidate = addDays(candidate, delta);
  }
  return candidate;
}

function daysUntil(iso: string | null, todayIso: string): number | null {
  if (!iso) return null;
  const a = new Date(iso.slice(0, 10) + 'T12:00:00Z').getTime();
  const b = new Date(todayIso + 'T12:00:00Z').getTime();
  return Math.floor((a - b) / 864e5);
}

// Local "now" parts for a given IANA timezone, using Intl.
function localPartsFor(tz: string): { hour: number; isoDate: string } {
  const now = new Date();
  let hourStr = '0';
  let y = '1970';
  let m = '01';
  let d = '01';
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    for (const part of fmt.formatToParts(now)) {
      if (part.type === 'hour') hourStr = part.value;
      if (part.type === 'year') y = part.value;
      if (part.type === 'month') m = part.value;
      if (part.type === 'day') d = part.value;
    }
  } catch (_) {
    // Bad/unknown tz: fall back to UTC parts.
    const iso = now.toISOString();
    return { hour: now.getUTCHours(), isoDate: iso.slice(0, 10) };
  }
  // '24' can appear for midnight in some environments; normalize to 0.
  let hour = parseInt(hourStr, 10);
  if (hour === 24) hour = 0;
  return { hour, isoDate: `${y}-${m}-${d}` };
}

// Does this {month,day} date object fall on today's local month/day?
function isDateObjToday(obj: any, localIsoDate: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const month = obj.month;
  const day = obj.day;
  if (month == null || day == null) return false;
  const [, mm, dd] = localIsoDate.split('-').map((x) => parseInt(x, 10));
  return month === mm && day === dd;
}

function displayName(row: any): string {
  const first = row.first_name || '';
  const last = row.last_name || '';
  const full = (first + ' ' + last).trim();
  return full || 'someone';
}

// ---- Expo push send ----

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: string;
  data?: Record<string, unknown>;
}

async function sendExpoPushBatch(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  // Expo accepts up to 100 messages per request.
  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const json = await resp.json();
      console.log('Expo push response:', JSON.stringify(json));
    } catch (e) {
      console.error('Expo push send failed:', (e as Error).message);
    }
  }
}

// ---- main handler ----

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Pull all opted-in users with a real token.
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select(
      'id, expo_push_token, timezone, notifications_enabled, notif_overdue, notif_birthdays',
    )
    .eq('notifications_enabled', true)
    .not('expo_push_token', 'is', null);

  if (profErr) {
    console.error('Failed to load profiles:', profErr.message);
    return new Response('error loading profiles', { status: 500 });
  }

  const messages: ExpoMessage[] = [];
  let usersConsidered = 0;
  let usersSent = 0;

  for (const profile of profiles || []) {
    const token = profile.expo_push_token as string;
    // Skip dev placeholders and obviously invalid tokens.
    if (!token || token === 'dev-no-device' || !token.startsWith('ExponentPushToken')) {
      continue;
    }

    const tz = profile.timezone || 'UTC';
    const { hour, isoDate } = localPartsFor(tz);

    usersConsidered++;

    // Only send during the send-hour in the user's local time.
    if (hour !== SEND_HOUR_LOCAL) continue;

    // Load this user's active contacts.
    const { data: contacts, error: cErr } = await supabase
      .from('contacts')
      .select(
        'first_name, last_name, last_contacted_at, contact_frequency, extra, archived',
      )
      .eq('user_id', profile.id)
      .eq('archived', false);

    if (cErr) {
      console.error(`Contacts load failed for ${profile.id}:`, cErr.message);
      continue;
    }

    let overdueCount = 0;
    const birthdayNames: string[] = [];
    const anniversaryNames: string[] = [];

    for (const c of contacts || []) {
      const extra = (c.extra as any) || {};

      // Overdue check
      if (profile.notif_overdue) {
        const lc = c.last_contacted_at ? String(c.last_contacted_at).slice(0, 10) : null;
        const freqStartedAt = extra.freqStartedAt
          ? String(extra.freqStartedAt).slice(0, 10)
          : null;
        const dow =
          typeof extra.freqDayOfWeek === 'number' ? extra.freqDayOfWeek : null;
        const nd = nextDate(lc, c.contact_frequency, freqStartedAt, dow, isoDate);
        const diff = daysUntil(nd, isoDate);
        if (diff != null && diff < 0) overdueCount++;
      }

      // Birthday / anniversary today
      if (profile.notif_birthdays) {
        if (isDateObjToday(extra.birthday, isoDate)) {
          birthdayNames.push(displayName(c));
        }
        if (extra.married === 'married' && isDateObjToday(extra.anniversary, isoDate)) {
          anniversaryNames.push(displayName(c));
        }
      }
    }

    // Build the notification body. One push per user, combining whatever
    // applies today. If nothing applies, send nothing.
    const lines: string[] = [];

    if (birthdayNames.length > 0) {
      if (birthdayNames.length === 1) {
        lines.push(`It's ${birthdayNames[0]}'s birthday today.`);
      } else {
        lines.push(`${birthdayNames.length} birthdays today: ${birthdayNames.join(', ')}.`);
      }
    }
    if (anniversaryNames.length > 0) {
      if (anniversaryNames.length === 1) {
        lines.push(`${anniversaryNames[0]} has an anniversary today.`);
      } else {
        lines.push(`${anniversaryNames.length} anniversaries today.`);
      }
    }
    if (overdueCount > 0) {
      lines.push(
        overdueCount === 1
          ? '1 contact is overdue for a follow-up.'
          : `${overdueCount} contacts are overdue for a follow-up.`,
      );
    }

    if (lines.length === 0) continue;

    const title =
      birthdayNames.length > 0 || anniversaryNames.length > 0
        ? 'Veery reminder'
        : 'Time to reconnect';

    messages.push({
      to: token,
      title,
      body: lines.join(' '),
      sound: 'default',
      data: { type: 'daily_digest' },
    });
    usersSent++;
  }

  await sendExpoPushBatch(messages);

  // Stamp last-sent on the users we notified (best effort).
  const sentTokens = messages.map((m) => m.to);
  if (sentTokens.length > 0) {
    try {
      await supabase
        .from('profiles')
        .update({ last_notification_sent_at: new Date().toISOString() })
        .in('expo_push_token', sentTokens);
    } catch (e) {
      console.error('Failed to stamp last_notification_sent_at:', (e as Error).message);
    }
  }

  const summary = {
    usersConsidered,
    usersSent,
    messagesSent: messages.length,
  };
  console.log('send-notifications summary:', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' },
  });
});