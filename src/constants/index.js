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
  '#0077B6', '#00C9A7', '#6B7FBA', '#E060A0',
  '#F4A261', '#48B8E0', '#2196A8', '#7B5EEA',
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

export const EMPTY_CONTACT = {
  name: '', company: '', role: '', email: '', phone: '', linkedin: '',
  howMet: '', howHelp: '', topics: '', notes: '', lastContacted: '',
  tags: [], freq: 'never', priority: false,
  birthday: '', timezone: '', location: '',
  hometown: '', married: null, spouseName: '', kids: [], interests: [],
  experience: '', pastCompanies: [],
  photo: '', convLog: [], archived: false,
};

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

// Sample data for first launch
export function getSampleContacts(addDays, isoToday) {
  const t = isoToday();
  return [
    {
      ...EMPTY_CONTACT,
      id: 's1',
      name: 'Sarah Chen',
      company: 'Blackstone Real Estate',
      role: 'Managing Director',
      email: 'schen@blackstone.com',
      phone: '(212) 555-0142',
      linkedin: 'sarahchen',
      howMet: 'ULI Spring Conference 2025',
      tags: ['Investor', 'Family Office'],
      freq: '1month',
      lastContacted: addDays(t, -35),
      hometown: 'New York, NY',
      topics: 'Discussed extended stay hotel thesis, interested in 506(c) offerings',
      convLog: [{
        id: 'n1',
        date: addDays(t, -35),
        text: 'Great conversation about workforce housing demand in secondary markets. Wants to see our next deal memo.',
        type: 'meeting',
      }],
    },
    {
      ...EMPTY_CONTACT,
      id: 's2',
      name: 'James Rodriguez',
      company: 'Blackstone Real Estate',
      role: 'VP of Acquisitions',
      email: 'jrodriguez@blackstone.com',
      phone: '(212) 555-0198',
      howMet: 'Referred by Sarah Chen',
      tags: ['Investor'],
      freq: '3months',
      lastContacted: addDays(t, -10),
      convLog: [{
        id: 'n2',
        date: addDays(t, -10),
        text: 'Quick call to introduce West77 thesis. He covers select-service hotels. Following up with deck.',
        type: 'call',
      }],
    },
    {
      ...EMPTY_CONTACT,
      id: 's3',
      name: 'Emily Park',
      company: 'Meridian Capital',
      role: 'Senior Vice President',
      email: 'epark@meridiancap.com',
      phone: '(310) 555-0267',
      linkedin: 'emilypark',
      howMet: 'NMHC Annual Conference',
      tags: ['Lender'],
      freq: '2weeks',
      lastContacted: addDays(t, -18),
      hometown: 'Los Angeles, CA',
      married: 'married',
      kids: [{ name: 'Olivia', age: '4', gender: 'girl' }],
      interests: ['Golf', 'Travel'],
      topics: 'Specializes in construction lending for hospitality',
      convLog: [{
        id: 'n3',
        date: addDays(t, -18),
        text: 'Discussed term sheet parameters for ground-up extended stay. She can do 65% LTC at SOFR+325.',
        type: 'call',
      }],
    },
    {
      ...EMPTY_CONTACT,
      id: 's4',
      name: 'David Kim',
      company: 'Wasatch Group',
      role: 'Director of Development',
      email: 'dkim@wasatchgroup.com',
      phone: '(801) 555-0334',
      howMet: 'BYU Real Estate Club alumni event',
      tags: ['Partner', 'Colleague'],
      freq: '1month',
      lastContacted: addDays(t, -2),
      hometown: 'Salt Lake City, UT',
      married: 'married',
      kids: [
        { name: 'Ben', age: '7', gender: 'boy' },
        { name: 'Sophie', age: '5', gender: 'girl' },
      ],
      interests: ['Skiing', 'Basketball', 'Faith'],
      convLog: [{
        id: 'n4',
        date: addDays(t, -2),
        text: 'Caught up over lunch. His team is looking at a site in Provo that could work for a JV.',
        type: 'meeting',
      }],
    },
    {
      ...EMPTY_CONTACT,
      id: 's5',
      name: 'Rachel Torres',
      company: 'Meridian Capital',
      role: 'Analyst',
      email: 'rtorres@meridiancap.com',
      phone: '(310) 555-0401',
      howMet: 'Introduced by Emily Park',
      tags: ['Lender'],
      freq: '3months',
      lastContacted: addDays(t, -45),
      notes: "Runs the models for Emily's team. Good to keep in the loop on deal flow.",
    },
  ];
}
