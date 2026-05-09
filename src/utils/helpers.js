import { TAG_COLORS, CUSTOM_TAG_COLORS, AV_COLORS, FREQ } from '../constants';

export const isoToday = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const nextDate = (lc, f) => {
  if (!lc || !f || f === 'never') return null;
  const o = FREQ.find((x) => x.v === f);
  return o && o.d ? addDays(lc, o.d) : null;
};

export const daysSince = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso.slice(0, 10) + 'T12:00:00').getTime()) / 864e5);
  return d < 0 ? 0 : d;
};

export const daysUntil = (iso) =>
  iso ? Math.floor((new Date(iso.slice(0, 10) + 'T12:00:00').getTime() - Date.now()) / 864e5) : null;

export const fmtDate = (iso) =>
  iso
    ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '';

export const fmtShort = (iso) =>
  iso
    ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      })
    : '';

export const initials = (n) =>
  (n || '').split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

export function avColor(n) {
  let h = 0;
  const s = n || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

export function getTagColor(tag) {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return CUSTOM_TAG_COLORS[Math.abs(h) % CUSTOM_TAG_COLORS.length];
}

export function tagColor(tags, fallback = '#4A6080') {
  return tags && tags[0] ? getTagColor(tags[0]) : fallback;
}

export function fmtPhone(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d.length ? '(' + d : d;
  if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}

export function strengthColor(lc, f, theme) {
  const nd = nextDate(lc, f);
  if (!nd) return theme.brd2;
  const diff = daysUntil(nd);
  if (diff < 0) return theme.red;
  if (diff <= 7) return theme.warn;
  return theme.ac;
}

export function makeVcf(c) {
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    'FN:' + (c.name || ''),
    c.company ? 'ORG:' + c.company : '',
    c.role ? 'TITLE:' + c.role : '',
    c.phone ? 'TEL;TYPE=CELL:' + c.phone : '',
    c.email ? 'EMAIL:' + c.email : '',
    c.hometown ? 'ADR;TYPE=HOME:;;' + c.hometown + ';;;;' : '',
    c.notes ? 'NOTE:' + c.notes.replace(/\n/g, ' ') : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n');
}

// =================== Date object utilities ===================

function numOrNull(x) {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function parseLegacyDate(input) {
  if (input == null) return null;
  if (typeof input === 'object') {
    return { month: numOrNull(input.month), day: numOrNull(input.day), year: numOrNull(input.year) };
  }
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10), year: parseInt(m[3], 10) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10), year: parseInt(m[3], 10) };
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: null };
  m = s.match(/^(\d{1,2})-(\d{1,2})$/);
  if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10), year: null };
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10), year: null };
  m = s.match(/^(\d{4})$/);
  if (m) return { year: parseInt(m[1], 10), month: null, day: null };
  return null;
}

export function dateObjectIsEmpty(obj) {
  if (!obj) return true;
  return obj.month == null && obj.day == null && obj.year == null;
}

export function formatDateObject(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') {
    const parsed = parseLegacyDate(obj);
    if (!parsed) return obj;
    return formatDateObject(parsed);
  }
  if (dateObjectIsEmpty(obj)) return '';
  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = obj.month;
  const d = obj.day;
  const y = obj.year;
  const mName = m && m >= 1 && m <= 12 ? monthShort[m - 1] : null;
  if (mName && d && y) return `${mName} ${d}, ${y}`;
  if (mName && d) return `${mName} ${d}`;
  if (mName && y) return `${mName} ${y}`;
  if (d && y) return `${d}/?/${y}`;
  if (y) return String(y);
  if (mName) return mName;
  if (d) return `Day ${d}`;
  return '';
}

export function calculateAge(obj, now = new Date()) {
  const parsed = obj && typeof obj === 'string' ? parseLegacyDate(obj) : obj;
  if (!parsed || parsed.year == null) return null;
  const todayY = now.getFullYear();
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();
  let age = todayY - parsed.year;
  if (parsed.month != null) {
    if (todayM < parsed.month) age -= 1;
    else if (todayM === parsed.month && parsed.day != null && todayD < parsed.day) age -= 1;
  }
  if (age < 0) return null;
  return age;
}

// Display age for a kid. Birthday object preferred; falls back to ageAsOf
// pair (age + asOf date), then legacy `age` string field.
export function displayKidAge(kid, now = new Date()) {
  if (!kid) return '';
  const bd = parseLegacyDate(kid.birthday);
  if (bd && bd.year != null) {
    const age = calculateAge(bd, now);
    if (age != null) {
      if (age === 0 && bd.month != null) {
        const months = (now.getFullYear() - bd.year) * 12 + (now.getMonth() + 1 - bd.month);
        if (months <= 0) return 'newborn';
        if (months === 1) return '1 mo';
        return months + ' mo';
      }
      return String(age);
    }
  }
  if (kid.ageAsOf && Number.isFinite(Number(kid.ageAsOf.age)) && kid.ageAsOf.asOf) {
    const enteredAge = Number(kid.ageAsOf.age);
    const asOfMs = new Date(kid.ageAsOf.asOf + 'T12:00:00').getTime();
    if (Number.isFinite(asOfMs)) {
      const yearsElapsed = (now.getTime() - asOfMs) / (1000 * 60 * 60 * 24 * 365.25);
      const current = enteredAge + yearsElapsed;
      if (current < 0) return String(enteredAge);
      const rounded = Math.round(current * 2) / 2;
      return rounded % 1 === 0 ? String(Math.floor(rounded)) : rounded.toFixed(1);
    }
  }
  if (kid.age) return String(kid.age);
  return '';
}

// =================== buildAIContext ===================

export function buildAIContext(c) {
  const p = [];
  if (c.name) p.push('Name: ' + c.name);
  if (c.company) p.push('Company: ' + c.company);
  if (c.role) p.push('Role: ' + c.role);
  if (c.linkedin) p.push('LinkedIn: ' + c.linkedin);
  if (c.howMet) p.push('How we met: ' + c.howMet);
  if (c.howHelp) p.push('How I can help them: ' + c.howHelp);
  if (c.experience) p.push('Experience: ' + c.experience);
  if (c.pastCompanies?.length)
    p.push('Past companies: ' + c.pastCompanies.map((pc) => pc.company + (pc.role ? ' (' + pc.role + ')' : '')).join(', '));
  if (c.lastContacted)
    p.push('Last contacted: ' + fmtDate(c.lastContacted) + ' (' + daysSince(c.lastContacted) + ' days ago)');
  if (c.tags?.length) p.push('Tags: ' + c.tags.join(', '));
  if (c.topics) p.push('Topics: ' + c.topics);
  if (c.notes) p.push('Notes: ' + c.notes);
  if (c.hometown) p.push('Hometown: ' + c.hometown);
  if (c.location) p.push('Current location: ' + c.location);
  if (c.timezone) p.push('Timezone: ' + c.timezone);
  const bdayStr = formatDateObject(c.birthday);
  if (bdayStr) p.push('Birthday: ' + bdayStr);
  if (c.priority) p.push('VIP / high-priority contact');
  if (c.married)
    p.push('Marital status: ' + c.married + (c.spouseName ? ' (spouse: ' + c.spouseName + ')' : ''));
  const annivStr = formatDateObject(c.anniversary);
  if (annivStr) p.push('Anniversary: ' + annivStr);
  if (c.interests?.length) p.push('Interests: ' + c.interests.join(', '));
  if (c.kids?.length) {
    const kidStrs = c.kids
      .map((k) => {
        const age = displayKidAge(k);
        return (k.name || '') + (age ? ' (age ' + age + ')' : '');
      })
      .filter((s) => s.trim());
    if (kidStrs.length) p.push('Kids: ' + kidStrs.join(', '));
  }
  const log = (c.convLog || []).slice(0, 5);
  if (log.length) p.push('Recent notes:\n' + log.map((e) => '- ' + e.date + ': ' + e.text).join('\n'));
  return p.join('\n');
}