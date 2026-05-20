// All shared constants, default data, and config

// ---------- Tags ----------
//
// Tags are grouped into categories that render as subsections on the form.
// Each tag has a stable `v` (value, stored on contacts) and a `l` (display
// label). The grouping is UI-only; downstream code just sees the flat list
// of tag values via `DEFAULT_TAGS`.

export const TAG_GROUPS = [
  {
    key: 'personal',
    label: 'Personal',
    tags: [
      { v: 'friend', l: 'Friend' },
      { v: 'colleague', l: 'Colleague' },
      { v: 'mentor', l: 'Mentor' },
    ],
  },
  {
    key: 'capital',
    label: 'Capital',
    tags: [
      { v: 'investor', l: 'Investor' },
      { v: 'lp', l: 'LP' },
      { v: 'gp', l: 'GP' },
      { v: 'family_office', l: 'Family Office' },
      { v: 'endowment_foundation', l: 'Endowment / Foundation' },
      { v: 'pension_fund', l: 'Pension Fund' },
      { v: 'fund_admin', l: 'Fund Admin' },
      { v: 'placement_agent', l: 'Placement Agent' },
      { v: 'ria', l: 'RIA' },
      { v: 'portfolio_company', l: 'Portfolio Company' },
    ],
  },
  {
    key: 'real_estate',
    label: 'Real Estate',
    tags: [
      { v: 're_investor', l: 'RE Investor' },
      { v: 'property_manager', l: 'Property Manager' },
      { v: 'agent_broker', l: 'Agent / Broker' },
      { v: 'buyer', l: 'Buyer' },
      { v: 'seller', l: 'Seller' },
      { v: 'lender', l: 'Lender' },
      { v: 'inspector', l: 'Inspector' },
      { v: 'title_escrow', l: 'Title / Escrow' },
      { v: 'contractor', l: 'Contractor' },
    ],
  },
  {
    key: 'service_provider',
    label: 'Service Provider',
    tags: [
      { v: 'client', l: 'Client' },
      { v: 'vendor_supplier', l: 'Vendor / Supplier' },
      { v: 'advisor', l: 'Advisor' },
      { v: 'recruiter', l: 'Recruiter' },
    ],
  },
];

// Flat list of tag values, derived from the groups. Existing code that
// iterates `DEFAULT_TAGS` (selectors, filters, search) keeps working.
export const DEFAULT_TAGS = TAG_GROUPS.flatMap((g) => g.tags.map((t) => t.v));

// Lookup helper: tag value -> display label. Falls back to the value
// itself for legacy tags or custom user-added tags.
export const TAG_LABELS = TAG_GROUPS.reduce((acc, g) => {
  for (const t of g.tags) acc[t.v] = t.l;
  return acc;
}, {});

export function getTagLabel(v) {
  if (!v) return '';
  return TAG_LABELS[v] || v;
}

// Per-tag colors. Each tag gets its own color so the pills look distinct
// even when grouped. Colors are loosely themed per group but each tag is
// still uniquely identifiable.
export const TAG_COLORS = {
  // Personal — warm pinks / coral
  friend: '#E060A0',
  colleague: '#D87090',
  mentor: '#C85890',

  // Capital — greens / teals
  investor: '#00C9A7',
  lp: '#20B89A',
  gp: '#40A790',
  family_office: '#5FB48A',
  endowment_foundation: '#7DAF7F',
  pension_fund: '#3A9D8F',
  fund_admin: '#2D8C7C',
  placement_agent: '#4FB3A0',
  ria: '#2196A8',
  portfolio_company: '#1D7F8C',

  // Real Estate — blues / earth tones
  re_investor: '#0077B6',
  property_manager: '#3D8FC5',
  agent_broker: '#48B8E0',
  buyer: '#6B7FBA',
  seller: '#8C7DB8',
  lender: '#5D6FAC',
  inspector: '#7090C0',
  title_escrow: '#5A8FB0',
  contractor: '#A57B5F',

  // Service Provider — purples / golds
  client: '#7B5EEA',
  vendor_supplier: '#9070D0',
  advisor: '#B060D0',
  recruiter: '#F4A261',
};

// Custom (user-added) tag colors. Cycled through in order.
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

export const EMPTY_CONTACT = {
  firstName: '', lastName: '', company: '', role: '',

  phone: '',
  email: '',

  phones: [],
  emails: [],
  addresses: [],

  initialIntroduction: '',
  notes: '',
  lastContacted: '',
  tags: [],
  freq: 'never',
  customFollowUpDate: '',
  priority: false,

  birthday: '',
  timezone: '', location: '',
  hometown: '',
  married: null,
  spouseName: '',
  anniversary: '',
  kids: [],
  interests: [],

  experience: '', pastCompanies: [],

  recipientName: '',
  mailingLists: [],

  photo: '',
  convLog: [],
  archived: false,
  isSample: false,
  sampleAddedAt: null,
};

// ---------- Display name helper ----------

export function getDisplayName(c) {
  if (!c || typeof c !== 'object') return '';
  const first = (c.firstName || '').trim();
  const last = (c.lastName || '').trim();
  if (first || last) return [first, last].filter(Boolean).join(' ');
  if (typeof c.name === 'string') return c.name.trim();
  return '';
}

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

export function formatFlexibleDate(s) {
  const parts = parseFlexibleDate(s);
  if (!parts) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = months[parts.month - 1];
  if (parts.hasYear) return `${monthName} ${parts.day}, ${parts.year}`;
  return `${monthName} ${parts.day}`;
}

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

export function migrateLegacyContact(c) {
  if (!c || typeof c !== 'object') return c;

  const out = { ...c };

  if (typeof out.firstName !== 'string') out.firstName = '';
  if (typeof out.lastName !== 'string') out.lastName = '';
  if (!out.firstName && !out.lastName && typeof out.name === 'string' && out.name.trim()) {
    const split = splitLegacyName(out.name);
    out.firstName = split.firstName;
    out.lastName = split.lastName;
  }

  if (typeof out.initialIntroduction !== 'string') {
    out.initialIntroduction = typeof out.howMet === 'string' ? out.howMet : '';
  }
  delete out.howMet;

  delete out.howHelp;
  delete out.linkedin;
  delete out.topics;

  if (typeof out.notes !== 'string') out.notes = '';
  if (typeof out.customFollowUpDate !== 'string') out.customFollowUpDate = '';

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
      tags: ['friend'],
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
        text: "Caught up over coffee. She's deep into a new pottery class and her dad just retired. He's planning a long trip to India.",
        type: 'meeting',
      }],
      archived: false,
      isSample: true,
      sampleAddedAt,
    },

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