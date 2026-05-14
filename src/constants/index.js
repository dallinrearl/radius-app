// All shared constants, default data, and config

export const DEFAULT_TAGS = [
  'Investor', 'Partner', 'Lender', 'Advisor',
  'Family Office', 'RIA', 'Colleague', 'Friend',
];

export const TAG_COLORS = {
  Investor: '#00C9A7',
  Partner: '#0077B6',
  Lender: '#48B8E0',
  Advisor: '#7B5EEA',
  'Family Office': '#F4A261',
  RIA: '#2196A8',
  Colleague: '#6B7FBA',
  Friend: '#E060A0',
};

export const CUSTOM_TAG_COLORS = [
  '#E06090', '#40B890', '#D4A040', '#6090D0', '#B060D0',
  '#50C0C0', '#D07040', '#80B040', '#C05070', '#5080C0',
];

export const AV_COLORS = [
  '#2D5A8A', '#3D6A9A', '#4A6FA0', '#345C8E',
  '#3F6792', '#487098', '#3A6088', '#4D75A0',
];

export const FREQ = [
  { v: 'never', l: 'No schedule', d: 0 },
  { v: '1week', l: 'Weekly', d: 7 },
  { v: '2weeks', l: 'Every 2 weeks', d: 14 },
  { v: '1month', l: 'Monthly', d: 30 },
  { v: '3months', l: 'Quarterly', d: 90 },
  { v: '6months', l: 'Every 6 months', d: 180 },
  { v: 'annual', l: 'Annually', d: 365 },
];

export const DEFAULT_INTERESTS = [
  'Golf', 'Tennis', 'Fishing', 'Hunting', 'Running', 'Cycling',
  'Skiing', 'Travel', 'Cooking', 'Wine', 'Reading', 'Music',
  'Art', 'Faith', 'Fitness', 'Football', 'Basketball',
  'Baseball', 'Soccer', 'Hockey',
];

export const TIMEZONES = [
  { v: '', l: 'Not set' },
  { v: 'ET', l: 'Eastern (ET)' },
  { v: 'CT', l: 'Central (CT)' },
  { v: 'MT', l: 'Mountain (MT)' },
  { v: 'PT', l: 'Pacific (PT)' },
  { v: 'AK', l: 'Alaska (AK)' },
  { v: 'HI', l: 'Hawaii (HI)' },
  { v: 'GMT', l: 'GMT / UTC' },
  { v: 'CET', l: 'Central European (CET)' },
  { v: 'GST', l: 'Gulf (GST)' },
  { v: 'IST', l: 'India (IST)' },
  { v: 'CST', l: 'China (CST)' },
  { v: 'JST', l: 'Japan (JST)' },
  { v: 'AEST', l: 'Australia Eastern (AEST)' },
];

export const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Indianapolis, IN',
  'Charlotte, NC', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'Nashville, TN',
  'Oklahoma City, OK', 'El Paso, TX', 'Washington, DC', 'Boston, MA', 'Las Vegas, NV',
  'Portland, OR', 'Memphis, TN', 'Louisville, KY', 'Baltimore, MD', 'Milwaukee, WI',
  'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Mesa, AZ', 'Sacramento, CA',
  'Atlanta, GA', 'Kansas City, MO', 'Omaha, NE', 'Colorado Springs, CO', 'Raleigh, NC',
  'Long Beach, CA', 'Virginia Beach, VA', 'Miami, FL', 'Oakland, CA', 'Minneapolis, MN',
  'Tampa, FL', 'Tulsa, OK', 'Arlington, TX', 'New Orleans, LA', 'Wichita, KS',
  'Cleveland, OH', 'Bakersfield, CA', 'Aurora, CO', 'Anaheim, CA', 'Honolulu, HI',
  'Santa Ana, CA', 'Riverside, CA', 'Corpus Christi, TX', 'Lexington, KY', 'Stockton, CA',
  'Pittsburgh, PA', 'St. Paul, MN', 'Cincinnati, OH', 'Anchorage, AK', 'Henderson, NV',
  'Greensboro, NC', 'Plano, TX', 'Newark, NJ', 'Lincoln, NE', 'Orlando, FL',
  'Irvine, CA', 'Toledo, OH', 'Jersey City, NJ', 'Chula Vista, CA', 'Durham, NC',
  'Fort Wayne, IN', 'St. Petersburg, FL', 'Laredo, TX', 'Norfolk, VA', 'Madison, WI',
  'Chandler, AZ', 'Lubbock, TX', 'Scottsdale, AZ', 'Reno, NV', 'Glendale, AZ',
  'Gilbert, AZ', 'Winston-Salem, NC', 'Boise, ID', 'Richmond, VA', 'Spokane, WA',
  'Des Moines, IA', 'Birmingham, AL', 'Salt Lake City, UT', 'Provo, UT', 'Lehi, UT',
  'Keller, TX', 'Frisco, TX', 'Boca Raton, FL', 'Park City, UT',
];

// ---------- Phone / Email / Address label presets ----------
//
// Defaults shown in the picker. Users can also type custom labels.

export const PHONE_LABELS  = ['Cell', 'Work', 'Home', 'Other'];
export const EMAIL_LABELS  = ['Personal', 'Work', 'Other'];
export const ADDRESS_LABELS = ['Home', 'Work', 'Vacation', 'Mailing', 'Other'];

// ---------- Empty entry factories ----------

export const emptyPhone = () => ({ label: 'Cell', value: '' });
export const emptyEmail = () => ({ label: 'Personal', value: '' });
export const emptyAddress = () => ({
  label: 'Home',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zip: '',
  country: '',
});

// ---------- EMPTY_CONTACT ----------
//
// Schema notes:
// - `firstName` and `lastName` replace the old single `name` field. The
//   legacy `name` is preserved on read by `migrateLegacyContact` (split on
//   first space) but no longer lives on EMPTY_CONTACT. Use
//   `getDisplayName(c)` everywhere that needs to render a contact label.
// - `initialIntroduction` replaces the old `howMet`. Same semantic field,
//   clearer name. Migration auto-renames on read.
// - Removed entirely: `topics`, `notes`-as-transcripts, `linkedin`, `howHelp`.
//   `notes` stays as a manual-only free-text field. Transcript / meeting
//   content lives exclusively in `convLog`.
// - `customFollowUpDate` is a one-off override that sits alongside `freq`.
//   When set, the UI treats it as the next scheduled follow-up regardless
//   of frequency. Format: 'YYYY-MM-DD' or ''.
//
// Date fields (birthday, anniversary, customFollowUpDate) are flexible
// strings. See `parseFlexibleDate` below.
//   - 'YYYY-MM-DD' (full date)
//   - 'MM-DD'      (no year, e.g. '06-15')   [birthday/anniversary only]
//   - ''           (not set)

export const EMPTY_CONTACT = {
  // Identity
  firstName: '', lastName: '', company: '', role: '',

  // Legacy single fields (kept for backward compat; migration moves them
  // into `phones` / `emails` on read).
  phone: '',
  email: '',

  // New multi-entry fields. First entry in each array is treated as the
  // primary / default.
  phones: [],     // [{ label, value }]
  emails: [],     // [{ label, value }]
  addresses: [],  // [{ label, line1, line2, city, state, zip, country }]

  // Relationship context
  initialIntroduction: '',
  notes: '',                  // MANUAL ONLY. AI must never write here.
  lastContacted: '',          // No longer manually editable. Derived from convLog.
  tags: [],
  freq: 'never',
  customFollowUpDate: '',     // 'YYYY-MM-DD' or ''. One-off override for next follow-up.
  priority: false,

  // Personal details
  birthday: '',     // flexible: 'YYYY-MM-DD' or 'MM-DD'
  timezone: '', location: '',
  hometown: '',
  married: null,    // null | 'married' | 'single' | etc.
  spouseName: '',
  anniversary: '',  // flexible: 'YYYY-MM-DD' or 'MM-DD'
  kids: [],
  interests: [],

  // Career
  experience: '', pastCompanies: [],

  // Mailing list / cards
  recipientName: '',  // override for mailing labels; falls back to display name
  mailingLists: [],   // array of mailing list ids the contact belongs to

  // System
  photo: '',
  convLog: [],
  archived: false,
  isSample: false,
  sampleAddedAt: null,
};

// ---------- Display name helper ----------
//
// Always use this to render a contact's name. Handles the legacy `name`
// field on contacts that haven't been touched by the migration yet.

export function getDisplayName(c) {
  if (!c || typeof c !== 'object') return '';
  const first = (c.firstName || '').trim();
  const last = (c.lastName || '').trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  if (typeof c.name === 'string') return c.name.trim();
  return '';
}

// Split a legacy single-name string into first/last on the first space.
// Single-word names become first name only.
export function splitLegacyName(s) {
  if (!s || typeof s !== 'string') return { firstName: '', lastName: '' };
  const trimmed = s.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const idx = trimmed.indexOf(' ');
  if (idx < 0) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1).trim(),
  };
}

// ---------- Flexible date helpers ----------

const FULL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY_RE = /^(\d{2})-(\d{2})$/;

export function parseFlexibleDate(s) {
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();
  let m = trimmed.match(FULL_DATE_RE);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (isValidMonthDay(month, day)) {
      return { year, month, day, hasYear: true };
    }
    return null;
  }
  m = trimmed.match(MONTH_DAY_RE);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (isValidMonthDay(month, day)) {
      return { year: null, month, day, hasYear: false };
    }
    return null;
  }
  return null;
}

function isValidMonthDay(month, day) {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

// Format a flexible date for display. Returns '' if not parseable.
//   '1990-06-15' -> 'Jun 15, 1990'
//   '06-15'      -> 'Jun 15'
export function formatFlexibleDate(s) {
  const parts = parseFlexibleDate(s);
  if (!parts) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = months[parts.month - 1];
  if (parts.hasYear) return `${monthName} ${parts.day}, ${parts.year}`;
  return `${monthName} ${parts.day}`;
}

// Convert separate MM/DD/YYYY string inputs into the flexible date format.
// Year is optional. Returns '' if month or day is missing/invalid.
//   ('06', '15', '1990') -> '1990-06-15'
//   ('06', '15', '')     -> '06-15'
//   ('6', '5', '')       -> '06-05'
export function partsToFlexibleDate(mm, dd, yyyy) {
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (!isValidMonthDay(month, day)) return '';
  const mmStr = String(month).padStart(2, '0');
  const ddStr = String(day).padStart(2, '0');
  const yearStr = (yyyy || '').toString().trim();
  if (yearStr && /^\d{4}$/.test(yearStr)) {
    return `${yearStr}-${mmStr}-${ddStr}`;
  }
  return `${mmStr}-${ddStr}`;
}

// Reverse of partsToFlexibleDate. Splits a stored date back into the three
// pieces the UI binds to. Empty strings for missing pieces.
//   '1990-06-15' -> { mm: '06', dd: '15', yyyy: '1990' }
//   '06-15'      -> { mm: '06', dd: '15', yyyy: '' }
//   ''           -> { mm: '',   dd: '',   yyyy: '' }
export function flexibleDateToParts(s) {
  const parts = parseFlexibleDate(s);
  if (!parts) return { mm: '', dd: '', yyyy: '' };
  return {
    mm: String(parts.month).padStart(2, '0'),
    dd: String(parts.day).padStart(2, '0'),
    yyyy: parts.hasYear ? String(parts.year) : '',
  };
}

// ---------- Migration helper ----------
//
// Takes a contact in any historical shape and returns it in the current
// shape. Idempotent — safe to call on already-migrated contacts.

export function migrateLegacyContact(c) {
  if (!c || typeof c !== 'object') return c;

  const out = { ...c };

  // Name: split legacy `name` into firstName/lastName.
  if (typeof out.firstName !== 'string') out.firstName = '';
  if (typeof out.lastName !== 'string') out.lastName = '';
  if (!out.firstName && !out.lastName && typeof out.name === 'string' && out.name.trim()) {
    const split = splitLegacyName(out.name);
    out.firstName = split.firstName;
    out.lastName = split.lastName;
  }
  // Keep `name` in the object for now so older display code doesn't break
  // mid-migration. Anything writing contacts should stop setting `name`.
  // It can be dropped entirely once the Supabase column migration ships.

  // initialIntroduction <- howMet
  if (typeof out.initialIntroduction !== 'string') {
    out.initialIntroduction = typeof out.howMet === 'string' ? out.howMet : '';
  }
  delete out.howMet;

  // Remove fields we no longer support.
  delete out.howHelp;
  delete out.linkedin;
  delete out.topics;

  // Notes: ensure it's a string (manual-only field).
  if (typeof out.notes !== 'string') out.notes = '';

  // customFollowUpDate (new field).
  if (typeof out.customFollowUpDate !== 'string') out.customFollowUpDate = '';

  // Phones/emails/addresses arrays.
  if (!Array.isArray(out.phones)) out.phones = [];
  if (out.phones.length === 0 && typeof out.phone === 'string' && out.phone.trim()) {
    out.phones = [{ label: 'Cell', value: out.phone.trim() }];
  }

  if (!Array.isArray(out.emails)) out.emails = [];
  if (out.emails.length === 0 && typeof out.email === 'string' && out.email.trim()) {
    out.emails = [{ label: 'Personal', value: out.email.trim() }];
  }

  if (!Array.isArray(out.addresses)) out.addresses = [];
  if (!Array.isArray(out.mailingLists)) out.mailingLists = [];

  if (typeof out.recipientName !== 'string') out.recipientName = '';
  if (typeof out.isSample !== 'boolean') out.isSample = false;
  if (out.sampleAddedAt === undefined) out.sampleAddedAt = null;
  if (typeof out.anniversary !== 'string') out.anniversary = '';

  return out;
}

export function migrateLegacyContacts(list) {
  if (!Array.isArray(list)) return [];
  return list.map(migrateLegacyContact);
}

// ---------- Contact accessor helpers ----------

export function getPrimaryPhone(c) {
  if (!c) return '';
  if (Array.isArray(c.phones) && c.phones.length > 0) return c.phones[0].value || '';
  return c.phone || '';
}

export function getPrimaryEmail(c) {
  if (!c) return '';
  if (Array.isArray(c.emails) && c.emails.length > 0) return c.emails[0].value || '';
  return c.email || '';
}

export function getPrimaryAddress(c) {
  if (!c) return null;
  if (Array.isArray(c.addresses) && c.addresses.length > 0) return c.addresses[0];
  return null;
}

export const TOUCH_TYPES = [
  { v: 'call', l: 'Call', c: '#00C9A7' },
  { v: 'email', l: 'Email', c: '#48B8E0' },
  { v: 'text', l: 'Text', c: '#7B5EEA' },
  { v: 'meeting', l: 'In Person', c: '#F4A261' },
  { v: 'linkedin', l: 'LinkedIn', c: '#0077B6' },
  { v: 'other', l: 'Other', c: '#6A8098' },
];

export const TEMPLATE_TYPES = [
  { v: 'cold', l: 'Cold Intro', desc: 'First-time outreach' },
  { v: 'followup', l: 'Follow Up', desc: 'After a meeting or call' },
  { v: 'checkin', l: 'Check In', desc: 'Staying on the radar' },
  { v: 'intro_req', l: 'Ask for Intro', desc: 'Request a warm introduction' },
  { v: 'share', l: 'Share Value', desc: 'Send something useful' },
];

// ---------- Sample contacts ----------

export function getSampleContacts(addDays, isoToday) {
  const t = isoToday();
  const sampleAddedAt = new Date().toISOString();

  return [
    // ---------- Personal: close friend from college ----------
    {
      ...EMPTY_CONTACT,
      id: 'sample_maya',
      firstName: 'Maya',
      lastName: 'Patel',
      company: '',
      role: '',

      phone: '(512) 555-0142',
      email: 'maya.patel@example.com',
      phones: [{ label: 'Cell', value: '(512) 555-0142' }],
      emails: [{ label: 'Personal', value: 'maya.patel@example.com' }],

      addresses: [{
        label: 'Home',
        line1: '482 Maple Ridge Ln',
        line2: '',
        city: 'Salt Lake City',
        state: 'UT',
        zip: '84105',
        country: 'US',
      }],
      recipientName: 'The Patel Family',

      initialIntroduction: 'College roommate. Stood up at her wedding.',
      notes: 'Allergic to shellfish. Loves audiobooks. Always brings the best wine.',
      lastContacted: addDays(t, -22),
      tags: ['close_friend', 'college_friend'],
      freq: '1month',
      customFollowUpDate: '',
      priority: false,

      birthday: '03-18',
      timezone: 'MT',
      location: 'Salt Lake City, UT',
      hometown: 'Austin, TX',
      married: 'married',
      spouseName: 'Raj',
      anniversary: '2018-09-22',
      kids: [
        { name: 'Arjun', age: '4', gender: 'boy', notes: 'Obsessed with dinosaurs and trains.' },
      ],
      interests: ['Cooking', 'Travel', 'Reading'],

      experience: '',
      pastCompanies: [],

      mailingLists: [],

      photo: '',
      convLog: [{
        id: 'sample_maya_log_1',
        date: addDays(t, -22),
        text: "Caught up over coffee. She's deep into a new pottery class and her dad just retired — he's planning a long trip to India.",
        type: 'meeting',
      }],
      archived: false,
      isSample: true,
      sampleAddedAt,
    },

    // ---------- Professional: mentor / advisor ----------
    {
      ...EMPTY_CONTACT,
      id: 'sample_marcus',
      firstName: 'Marcus',
      lastName: 'Johnson',
      company: 'Ridgeline Advisors',
      role: 'Senior Partner',

      phone: '(303) 555-0287',
      email: 'mjohnson@ridgelineadvisors.com',
      phones: [{ label: 'Work', value: '(303) 555-0287' }],
      emails: [{ label: 'Work', value: 'mjohnson@ridgelineadvisors.com' }],

      addresses: [{
        label: 'Work',
        line1: '1801 Wynkoop St',
        line2: 'Suite 400',
        city: 'Denver',
        state: 'CO',
        zip: '80202',
        country: 'US',
      }],
      recipientName: '',

      initialIntroduction: 'Introduced by a former colleague at an industry event.',
      notes: 'Direct communicator. Prefers email over text. Reads everything you send him.',
      lastContacted: addDays(t, -42),
      tags: ['mentor', 'advisor'],
      freq: '3months',
      customFollowUpDate: '',
      priority: true,

      birthday: '1968-07-14',
      timezone: 'MT',
      location: 'Denver, CO',
      hometown: 'Chicago, IL',
      married: 'married',
      spouseName: '',
      anniversary: '',
      kids: [],
      interests: ['Cycling', 'Reading'],

      experience: '20+ years in advisory work. Previously CFO at two mid-cap companies. Sits on three boards.',
      pastCompanies: [
        { company: 'Vantage Holdings', role: 'CFO' },
        { company: 'Northbrook Industries', role: 'VP Finance' },
      ],

      mailingLists: [],

      photo: '',
      convLog: [{
        id: 'sample_marcus_log_1',
        date: addDays(t, -42),
        text: 'Quarterly check-in call. Talked through career transition options. He took the board role at the energy company and is excited about it.',
        type: 'call',
      }],
      archived: false,
      isSample: true,
      sampleAddedAt,
    },
  ];
}