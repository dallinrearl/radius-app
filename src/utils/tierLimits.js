// Tier limits — single source of truth for what each tier allows.
//
// Treat this file as the contract between the database (what tier a user is)
// and the UI (what they can do). Everything that gates by tier should
// reference these constants rather than hardcoding limits inline.

export const TIERS = {
  FREE: 'free',
  TRIAL: 'trial',
  PRO: 'pro',
};

// Per-tier limits and feature flags.
// Each tier object describes what's allowed. Adding a new tier later
// (e.g. 'premium') just adds a new entry here.
export const TIER_LIMITS = {
  free: {
    aiCallsPerMonth: 5,
    granolaSync: true,
    granolaAiProcessing: false,
    businessCardScan: false,
    recommendedOutreaches: false,
    multiDeviceSync: false,
    label: 'Free',
  },
  trial: {
    aiCallsPerMonth: Infinity,
    granolaSync: true,
    granolaAiProcessing: true,
    businessCardScan: true,
    recommendedOutreaches: true,
    multiDeviceSync: true,
    label: 'Pro (trial)',
  },
  pro: {
    aiCallsPerMonth: Infinity,
    granolaSync: true,
    granolaAiProcessing: true,
    businessCardScan: true,
    recommendedOutreaches: true,
    multiDeviceSync: true,
    label: 'Pro',
  },
};

// Pricing constants. Used by paywall modal and pricing page.
export const PRICING = {
  proMonthly: { amount: 9.99, currency: 'USD', label: '$9.99/mo' },
  proAnnual: { amount: 89.99, currency: 'USD', label: '$89.99/yr', savings: '$30' },
  trialDays: 7,
};

// Helper: get the limits object for a given tier string.
// Falls back to free if tier is unrecognized.
export function getLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

// Helper: can this tier make an AI call given current usage?
// `aiCallsCount` is how many they've made in the current monthly cycle.
export function canMakeAiCall(tier, aiCallsCount) {
  const limits = getLimits(tier);
  if (limits.aiCallsPerMonth === Infinity) return true;
  return aiCallsCount < limits.aiCallsPerMonth;
}

// Helper: how many AI calls remain this month?
// Returns Infinity for Pro/trial. Returns 0 if at or over cap.
export function aiCallsRemaining(tier, aiCallsCount) {
  const limits = getLimits(tier);
  if (limits.aiCallsPerMonth === Infinity) return Infinity;
  return Math.max(0, limits.aiCallsPerMonth - aiCallsCount);
}

// Helper: a feature flag check by name. UI components use this for gating.
//   isFeatureUnlocked(tier, 'granolaAiProcessing') -> true/false
export function isFeatureUnlocked(tier, featureKey) {
  const limits = getLimits(tier);
  return !!limits[featureKey];
}

// Helper: should we reset the user's AI counter? True if their last reset
// was in a previous calendar month (or never).
export function shouldResetAiCounter(aiCallsResetAt) {
  if (!aiCallsResetAt) return true;
  const reset = new Date(aiCallsResetAt);
  const now = new Date();
  return (
    reset.getFullYear() !== now.getFullYear() ||
    reset.getMonth() !== now.getMonth()
  );
}

// Helper: is a trial currently active for a user?
// Returns true only if tier is 'trial' AND trial_expires_at is in the future.
export function isTrialActive(tier, trialExpiresAt) {
  if (tier !== TIERS.TRIAL) return false;
  if (!trialExpiresAt) return false;
  return new Date(trialExpiresAt).getTime() > Date.now();
}

// Helper: days remaining on trial (rounded up). Null if not trialing.
export function trialDaysRemaining(tier, trialExpiresAt) {
  if (!isTrialActive(tier, trialExpiresAt)) return null;
  const ms = new Date(trialExpiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}