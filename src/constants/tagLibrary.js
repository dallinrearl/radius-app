// src/constants/tagLibrary.js
// Master tag library. Tags are organized into subcategories so the Settings →
// Tags screen can group them visually.
//
// Each tag has:
//   key:          stable identifier stored on contacts and in user.active_tags
//   label:        display string
//   subcategory:  'personal' | 'general_professional' | 'real_estate' | 'capital_pe'

export const SUBCATEGORIES = [
  { key: 'personal',             label: 'Personal' },
  { key: 'general_professional', label: 'General Professional' },
  { key: 'real_estate',          label: 'Real Estate' },
  { key: 'capital_pe',           label: 'Capital & PE' },
];

export const PROFESSIONAL_SUBCATEGORIES = [
  'general_professional',
  'real_estate',
  'capital_pe',
];

export const TAGS = [
  // ---------- Personal (14) ----------
  { key: 'family',             label: 'Family',                subcategory: 'personal' },
  { key: 'close_friend',       label: 'Close Friend',          subcategory: 'personal' },
  { key: 'friend',             label: 'Friend',                subcategory: 'personal' },
  { key: 'high_school_friend', label: 'High School Friend',    subcategory: 'personal' },
  { key: 'college_friend',     label: 'College Friend',        subcategory: 'personal' },
  { key: 'work_friend',        label: 'Work Friend',           subcategory: 'personal' },
  { key: 'old_friend',         label: 'Old Friend',            subcategory: 'personal' },
  { key: 'neighbor',           label: 'Neighbor',              subcategory: 'personal' },
  { key: 'church',             label: 'Church / Faith',        subcategory: 'personal' },
  { key: 'school_parent',      label: 'School Parent',         subcategory: 'personal' },
  { key: 'kid_friend_parent',  label: "Kid's Friend's Parent", subcategory: 'personal' },
  { key: 'extended_family',    label: 'Extended Family',       subcategory: 'personal' },
  { key: 'travel_buddy',       label: 'Travel Buddy',          subcategory: 'personal' },
  { key: 'workout_partner',    label: 'Workout Partner',       subcategory: 'personal' },

  // ---------- General Professional (15) ----------
  { key: 'colleague',        label: 'Colleague',         subcategory: 'general_professional' },
  { key: 'former_colleague', label: 'Former Colleague',  subcategory: 'general_professional' },
  { key: 'direct_report',    label: 'Direct Report',     subcategory: 'general_professional' },
  { key: 'mentor',           label: 'Mentor',            subcategory: 'general_professional' },
  { key: 'mentee',           label: 'Mentee',            subcategory: 'general_professional' },
  { key: 'client',           label: 'Client',            subcategory: 'general_professional' },
  { key: 'prospect',         label: 'Prospect',          subcategory: 'general_professional' },
  { key: 'former_client',    label: 'Former Client',     subcategory: 'general_professional' },
  { key: 'vendor',           label: 'Vendor / Supplier', subcategory: 'general_professional' },
  { key: 'investor',         label: 'Investor',          subcategory: 'general_professional' },
  { key: 'advisor',          label: 'Advisor',           subcategory: 'general_professional' },
  { key: 'board_member',     label: 'Board Member',      subcategory: 'general_professional' },
  { key: 'recruiter',        label: 'Recruiter',         subcategory: 'general_professional' },
  { key: 'candidate',        label: 'Candidate',         subcategory: 'general_professional' },
  { key: 'alumni_network',   label: 'Alumni Network',    subcategory: 'general_professional' },

  // ---------- Real Estate (9) ----------
  { key: 're_buyer',        label: 'Buyer',            subcategory: 'real_estate' },
  { key: 're_seller',       label: 'Seller',           subcategory: 'real_estate' },
  { key: 're_agent',        label: 'Agent / Broker',   subcategory: 'real_estate' },
  { key: 're_lender',       label: 'Lender',           subcategory: 'real_estate' },
  { key: 're_inspector',    label: 'Inspector',        subcategory: 'real_estate' },
  { key: 're_title',        label: 'Title / Escrow',   subcategory: 'real_estate' },
  { key: 're_contractor',   label: 'Contractor',       subcategory: 'real_estate' },
  { key: 're_investor',     label: 'RE Investor',      subcategory: 'real_estate' },
  { key: 're_property_mgr', label: 'Property Manager', subcategory: 'real_estate' },

  // ---------- Capital & PE (9) ----------
  { key: 'cap_lp',            label: 'LP',                     subcategory: 'capital_pe' },
  { key: 'cap_gp',            label: 'GP',                     subcategory: 'capital_pe' },
  { key: 'cap_ria',           label: 'RIA',                    subcategory: 'capital_pe' },
  { key: 'cap_placement',     label: 'Placement Agent',        subcategory: 'capital_pe' },
  { key: 'cap_family_office', label: 'Family Office',          subcategory: 'capital_pe' },
  { key: 'cap_endowment',     label: 'Endowment / Foundation', subcategory: 'capital_pe' },
  { key: 'cap_pension',       label: 'Pension Fund',           subcategory: 'capital_pe' },
  { key: 'cap_fund_admin',    label: 'Fund Admin',             subcategory: 'capital_pe' },
  { key: 'cap_portfolio_co',  label: 'Portfolio Company',      subcategory: 'capital_pe' },
];

// ---------- Common Tags ----------
//
// Curated cross-section of the most universally useful tags. Shown as a
// "Common Tags" section at the top of the Tags settings screen, and used
// as the default-visible set for new users (everything else is hidden by
// default until the user opts in).

export const COMMON_TAG_LABELS = [
  'Friend',
  'Colleague',
  'Mentor',
  'Client',
  'Investor',
  'Advisor',
  'Vendor / Supplier',
  'Recruiter',
];

// ---------------- Helpers ----------------

/**
 * Compute the default-active tag keys for a user based on use_type.
 * Used at onboarding completion to seed user.active_tags.
 *
 * @param {Object} opts
 * @param {string[]} opts.use_type  Array containing 'personal', 'professional', or both.
 * @returns {string[]} array of tag keys
 */
export function computeDefaultActiveTags({ use_type = [] } = {}) {
  const active = [];
  for (const tag of TAGS) {
    if (tag.subcategory === 'personal' && use_type.includes('personal')) {
      active.push(tag.key);
    } else if (
      PROFESSIONAL_SUBCATEGORIES.includes(tag.subcategory) &&
      use_type.includes('professional')
    ) {
      active.push(tag.key);
    }
  }
  return active;
}

/**
 * Get full tag objects from a list of tag keys. Skips unknown keys.
 * Preserves original library order.
 */
export function getTagsByKeys(keys = []) {
  const set = new Set(keys);
  return TAGS.filter((t) => set.has(t.key));
}

/**
 * Group all tags by subcategory for the Settings → Tags screen.
 * Returns an array of { key, label, tags } in display order.
 */
export function groupTagsBySubcategory() {
  return SUBCATEGORIES.map((sc) => ({
    key: sc.key,
    label: sc.label,
    tags: TAGS.filter((t) => t.subcategory === sc.key),
  }));
}

/**
 * Look up a tag's display label by its key. Returns the key itself if not found.
 */
export function getTagLabel(key) {
  return TAGS.find((t) => t.key === key)?.label ?? key;
}