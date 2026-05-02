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

export const daysSince = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 864e5) : null;

export const daysUntil = (iso) =>
  iso ? Math.floor((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 864e5) : null;

export const fmtDate = (iso) =>
  iso
    ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

export const fmtShort = (iso) =>
  iso
    ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

export const initials = (n) =>
  (n || '')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + (c.name || ''),
    c.company ? 'ORG:' + c.company : '',
    c.role ? 'TITLE:' + c.role : '',
    c.phone ? 'TEL;TYPE=CELL:' + c.phone : '',
    c.email ? 'EMAIL:' + c.email : '',
    c.hometown ? 'ADR;TYPE=HOME:;;' + c.hometown + ';;;;' : '',
    c.notes ? 'NOTE:' + c.notes.replace(/\n/g, ' ') : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n');
}

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
    p.push(
      'Past companies: ' +
        c.pastCompanies
          .map((pc) => pc.company + (pc.role ? ' (' + pc.role + ')' : ''))
          .join(', '),
    );
  if (c.lastContacted)
    p.push('Last contacted: ' + fmtDate(c.lastContacted) + ' (' + daysSince(c.lastContacted) + ' days ago)');
  if (c.tags?.length) p.push('Tags: ' + c.tags.join(', '));
  if (c.topics) p.push('Topics: ' + c.topics);
  if (c.notes) p.push('Notes: ' + c.notes);
  if (c.hometown) p.push('Hometown: ' + c.hometown);
  if (c.location) p.push('Current location: ' + c.location);
  if (c.timezone) p.push('Timezone: ' + c.timezone);
  if (c.birthday) p.push('Birthday: ' + c.birthday);
  if (c.priority) p.push('VIP / high-priority contact');
  if (c.married)
    p.push('Marital status: ' + c.married + (c.spouseName ? ' (spouse: ' + c.spouseName + ')' : ''));
  if (c.interests?.length) p.push('Interests: ' + c.interests.join(', '));
  if (c.kids?.length)
    p.push('Kids: ' + c.kids.map((k) => k.name + (k.age ? ' (age ' + k.age + ')' : '')).join(', '));
  const log = (c.convLog || []).slice(0, 5);
  if (log.length) p.push('Recent notes:\n' + log.map((e) => '- ' + e.date + ': ' + e.text).join('\n'));
  return p.join('\n');
}
