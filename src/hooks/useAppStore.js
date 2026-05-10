import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { fetchContacts, syncContacts } from '../lib/contactsApi';
import { fetchProfile, updateProfile, incrementAiCounter, resetAiCounter } from '../lib/profileApi';
import { isoToday, addDays, nextDate, daysUntil } from '../utils/helpers';
import {
  TIERS,
  canMakeAiCall,
  aiCallsRemaining,
  isFeatureUnlocked,
  shouldResetAiCounter,
  isTrialActive,
  trialDaysRemaining,
} from '../utils/tierLimits';
import {
  EMPTY_CONTACT,
  getSampleContacts,
  DEFAULT_INTERESTS,
} from '../constants';
import { TAGS as MASTER_TAGS, COMMON_TAG_LABELS } from '../constants/tagLibrary';
import { mergeQueue, removeFromQueue, updateQueueItem } from '../utils/reviewQueue';

const MASTER_TAG_LABELS = MASTER_TAGS.map((t) => t.label);

const HOLIDAY_LIST_ID = 'holiday_card_list';

// AsyncStorage key for the Granola review queue. Local-only for Stage 1;
// will migrate to Supabase user_settings when Stage 2 cron arrives.
const REVIEW_QUEUE_STORAGE = 'crm-review-queue';

function newMailingList(name) {
  return {
    id: 'list_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: name || 'Untitled List',
    createdAt: new Date().toISOString(),
    addressOverrides: {},
  };
}

export function useAppStore() {
  const [userId, setUserId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [myCard, setMyCard] = useState({ ...EMPTY_CONTACT });
  const [customTags, setCustomTags] = useState([]);
  const [hiddenTags, setHiddenTags] = useState([]);
  const [customInterests, setCustomInterests] = useState([]);
  const [hiddenInterests, setHiddenInterests] = useState([]);
  const [pin, setPin] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [onboarded, setOnboarded] = useState(true);

  const [useType, setUseType] = useState([]);
  const [samplesRequested, setSamplesRequestedState] = useState(null);

  const [mailingLists, setMailingLists] = useState([]);

  // Whether the user has dismissed the "still using samples?" banner.
  // Stored locally so it persists across sessions on the same device.
  const [samplesBannerDismissed, setSamplesBannerDismissedState] = useState(false);

  // Granola review queue. Items needing user triage (name-only matches,
  // unmatched attendees). Persisted to AsyncStorage for now.
  const [reviewQueue, setReviewQueue] = useState([]);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // Tracks fetch errors so the UI can distinguish "no contacts" from
  // "couldn't load contacts". Null = no error, string = last error message.
  const [contactsFetchError, setContactsFetchError] = useState(null);
  const [contactsFetching, setContactsFetching] = useState(false);

  // ---------- Tier / subscription state ----------
  // Profile holds the user's tier, AI usage counter, trial state, Stripe IDs.
  // Loaded from Supabase on auth, refreshed after upgrades / counter changes.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Modal state — when AI cap is hit, this gets set to a reason string.
  // Components read it to render the upgrade modal.
  const [paywallReason, setPaywallReason] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setUserId(session?.user?.id || null);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refetchContacts = useCallback(async () => {
    if (!userId) return;
    setContactsFetching(true);
    setContactsFetchError(null);
    try {
      const cloud = await fetchContacts();
      setContacts(cloud);
    } catch (e) {
      console.error('refetchContacts error:', e);
      setContactsFetchError(e?.message || 'Could not load contacts');
    }
    setContactsFetching(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setContacts([]);
      setContactsFetchError(null);
      return;
    }
    refetchContacts();
  }, [userId, refetchContacts]);

  // ---------- Profile / tier loading ----------
  // Loads profile when userId changes. Also resets the AI counter if the
  // last reset was in a previous calendar month.
  const refetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      let p = await fetchProfile();
      if (p && shouldResetAiCounter(p.ai_calls_reset_at)) {
        // Auto-reset on month rollover. Background, fire-and-forget on error.
        try {
          p = await resetAiCounter();
        } catch (e) {
          console.warn('AI counter reset failed:', e?.message);
        }
      }
      setProfile(p);
    } catch (e) {
      console.warn('refetchProfile error:', e?.message);
      // Don't block app on profile load failure. Default to a free-tier
      // assumption locally (set below in the derived helpers).
      setProfile(null);
    }
    setProfileLoading(false);
  }, [userId]);

  useEffect(() => {
    refetchProfile();
  }, [userId, refetchProfile]);

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get('crm-onboarded');
        setOnboarded(r?.value === 'true');
      } catch (_) {
        setOnboarded(false);
      }
      try {
        const r = await storage.get('crm-mycard');
        if (r?.value) setMyCard(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-tags');
        if (r?.value) setCustomTags(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-hidden-tags');
        if (r?.value) setHiddenTags(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-interests');
        if (r?.value) setCustomInterests(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-hidden-interests');
        if (r?.value) setHiddenInterests(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-pin');
        if (r?.value) setPin(r.value);
      } catch (_) {}
      try {
        const r = await storage.get('crm-displayname');
        if (r?.value) setDisplayName(r.value);
      } catch (_) {}
      try {
        const r = await storage.get('crm-username');
        if (r?.value) setUsername(r.value);
      } catch (_) {}
      try {
        const r = await storage.get('crm-password');
        if (r?.value) setPassword(r.value);
      } catch (_) {}
      try {
        const r = await storage.get('crm-use-type');
        if (r?.value) setUseType(JSON.parse(r.value));
      } catch (_) {}
      try {
        const r = await storage.get('crm-samples-requested');
        if (r?.value === 'true') setSamplesRequestedState(true);
        else if (r?.value === 'false') setSamplesRequestedState(false);
      } catch (_) {}
      try {
        const r = await storage.get('crm-samples-banner-dismissed');
        if (r?.value === 'true') setSamplesBannerDismissedState(true);
      } catch (_) {}

      try {
        const r = await storage.get('crm-mailing-lists');
        if (r?.value) {
          setMailingLists(JSON.parse(r.value));
        } else {
          const seeded = await storage.get('crm-mailing-lists-seeded');
          if (seeded?.value !== 'true') {
            const initial = [
              {
                id: HOLIDAY_LIST_ID,
                name: 'Holiday Card List',
                createdAt: new Date().toISOString(),
                addressOverrides: {},
              },
            ];
            setMailingLists(initial);
            try {
              await storage.set('crm-mailing-lists', JSON.stringify(initial));
              await storage.set('crm-mailing-lists-seeded', 'true');
            } catch (_) {}
          }
        }
      } catch (_) {}

      try {
        const r = await storage.get(REVIEW_QUEUE_STORAGE);
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed)) setReviewQueue(parsed);
        }
      } catch (_) {}

      setLoaded(true);
    })();
  }, []);

  const persistContacts = useCallback(
    async (d) => {
      if (!userId) return;
      setSaving(true);
      try {
        const result = await syncContacts(d, userId);
        if (result.ok && result.contacts) {
          setContacts(result.contacts);
        }
      } catch (e) {
        console.error('persistContacts error:', e);
      }
      setSaving(false);
    },
    [userId],
  );

  const commit = useCallback(
    (d) => {
      setContacts(d);
      persistContacts(d);
    },
    [persistContacts],
  );

  const saveMyCard = useCallback(async (card) => {
    setMyCard(card);
    try {
      await storage.set('crm-mycard', JSON.stringify(card));
    } catch (_) {}
  }, []);

  const saveCustomTags = useCallback(async (tags) => {
    setCustomTags(tags);
    try {
      await storage.set('crm-tags', JSON.stringify(tags));
    } catch (_) {}
  }, []);

  const saveHiddenTags = useCallback(async (tags) => {
    setHiddenTags(tags);
    try {
      await storage.set('crm-hidden-tags', JSON.stringify(tags));
    } catch (_) {}
  }, []);

  const saveCustomInterests = useCallback(async (tags) => {
    setCustomInterests(tags);
    try {
      await storage.set('crm-interests', JSON.stringify(tags));
    } catch (_) {}
  }, []);

  const saveHiddenInterests = useCallback(async (tags) => {
    setHiddenInterests(tags);
    try {
      await storage.set('crm-hidden-interests', JSON.stringify(tags));
    } catch (_) {}
  }, []);

  const saveUseType = useCallback(async (arr) => {
    const safe = Array.isArray(arr) ? arr : [];
    setUseType(safe);
    try {
      await storage.set('crm-use-type', JSON.stringify(safe));
    } catch (_) {}
  }, []);

  const saveSamplesRequested = useCallback(async (val) => {
    setSamplesRequestedState(val);
    try {
      await storage.set('crm-samples-requested', val ? 'true' : 'false');
    } catch (_) {}
  }, []);

  // ---------- Sample cleanup ----------

  const clearSampleContacts = useCallback(() => {
    const next = contacts.filter((c) => !c.isSample);
    if (next.length !== contacts.length) {
      commit(next);
    }
  }, [contacts, commit]);

  const dismissSamplesBanner = useCallback(async () => {
    setSamplesBannerDismissedState(true);
    try {
      await storage.set('crm-samples-banner-dismissed', 'true');
    } catch (_) {}
  }, []);

  // ---------- Mailing list CRUD ----------

  const persistMailingLists = useCallback(async (next) => {
    setMailingLists(next);
    try {
      await storage.set('crm-mailing-lists', JSON.stringify(next));
    } catch (_) {}
  }, []);

  const createMailingList = useCallback(
    async (name) => {
      const list = newMailingList(name);
      await persistMailingLists([...mailingLists, list]);
      return list;
    },
    [mailingLists, persistMailingLists],
  );

  const renameMailingList = useCallback(
    async (id, name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      const next = mailingLists.map((l) =>
        l.id === id ? { ...l, name: trimmed } : l,
      );
      await persistMailingLists(next);
    },
    [mailingLists, persistMailingLists],
  );

  const deleteMailingList = useCallback(
    async (id) => {
      const next = mailingLists.filter((l) => l.id !== id);
      await persistMailingLists(next);
      const updatedContacts = contacts.map((c) => {
        if (!Array.isArray(c.mailingLists) || !c.mailingLists.includes(id)) {
          return c;
        }
        return {
          ...c,
          mailingLists: c.mailingLists.filter((x) => x !== id),
        };
      });
      const anyTouched = updatedContacts.some((c, i) => c !== contacts[i]);
      if (anyTouched) {
        commit(updatedContacts);
      }
    },
    [mailingLists, persistMailingLists, contacts, commit],
  );

  const setAddressOverride = useCallback(
    async (listId, contactId, addressIndex) => {
      const next = mailingLists.map((l) => {
        if (l.id !== listId) return l;
        const overrides = { ...(l.addressOverrides || {}) };
        if (addressIndex == null || addressIndex < 0) {
          delete overrides[contactId];
        } else {
          overrides[contactId] = addressIndex;
        }
        return { ...l, addressOverrides: overrides };
      });
      await persistMailingLists(next);
    },
    [mailingLists, persistMailingLists],
  );

  const toggleContactOnList = useCallback(
    (contact, listId) => {
      const current = Array.isArray(contact.mailingLists) ? contact.mailingLists : [];
      const next = current.includes(listId)
        ? current.filter((x) => x !== listId)
        : [...current, listId];
      const updated = { ...contact, mailingLists: next };
      const updatedContacts = contacts.map((c) => (c.id === contact.id ? updated : c));
      commit(updatedContacts);
      return updated;
    },
    [contacts, commit],
  );

  // ---------- Review queue (Granola sync) ----------
  //
  // The queue holds items where sync couldn't confidently match an attendee
  // to a contact. The user triages each item from ReviewQueueScreen.
  // Items are deduplicated by stable id (noteId + attendee key), so re-syncing
  // the same meeting won't re-add items the user has already handled.

  const persistReviewQueue = useCallback(async (next) => {
    setReviewQueue(next);
    try {
      await storage.set(REVIEW_QUEUE_STORAGE, JSON.stringify(next));
    } catch (_) {}
  }, []);

  // Add new items to the queue (deduplicated by id). Used by sync.
  const addToReviewQueue = useCallback(
    async (newItems) => {
      if (!Array.isArray(newItems) || newItems.length === 0) return;
      const merged = mergeQueue(reviewQueue, newItems);
      await persistReviewQueue(merged);
    },
    [reviewQueue, persistReviewQueue],
  );

  // Remove a single item from the queue by id. Used after triage.
  const removeFromReviewQueue = useCallback(
    async (itemId) => {
      const next = removeFromQueue(reviewQueue, itemId);
      await persistReviewQueue(next);
    },
    [reviewQueue, persistReviewQueue],
  );

  // Patch a queue item in place (e.g. to attach AI suggestions before showing them).
  const patchReviewQueueItem = useCallback(
    async (itemId, patch) => {
      const next = updateQueueItem(reviewQueue, itemId, patch);
      await persistReviewQueue(next);
    },
    [reviewQueue, persistReviewQueue],
  );

  // Clear the entire queue. Used by Disconnect Granola.
  const clearReviewQueue = useCallback(async () => {
    await persistReviewQueue([]);
  }, [persistReviewQueue]);

  const allTags = [...MASTER_TAG_LABELS, ...customTags];
  const visibleTags = allTags.filter((t) => !hiddenTags.includes(t));

  const allInterests = [...DEFAULT_INTERESTS, ...customInterests];
  const visibleInterests = allInterests.filter((t) => !hiddenInterests.includes(t));

  const addCustomTag = (name) => {
    if (!name?.trim() || allTags.includes(name.trim())) return;
    saveCustomTags([...customTags, name.trim()]);
  };
  const addCustomInterest = (name) => {
    if (!name?.trim() || allInterests.includes(name.trim())) return;
    saveCustomInterests([...customInterests, name.trim()]);
  };

  const savePin = async (p) => {
    setPin(p);
    try {
      await storage.set('crm-pin', p);
    } catch (_) {}
  };
  const removePin = async () => {
    setPin(null);
    try {
      await storage.delete('crm-pin');
    } catch (_) {}
  };
  const saveDisplayName = async (n) => {
    setDisplayName(n);
    try {
      await storage.set('crm-displayname', n);
    } catch (_) {}
  };
  const saveUsername = async (n) => {
    setUsername(n);
    try {
      await storage.set('crm-username', n);
    } catch (_) {}
  };
  const savePassword = async (n) => {
    setPassword(n);
    try {
      await storage.set('crm-password', n);
    } catch (_) {}
  };

  const finishOnboarding = useCallback(
    async (opts = {}) => {
      if (Array.isArray(opts.useType)) {
        await saveUseType(opts.useType);
      }
      if (hiddenTags.length === 0) {
        const seedHidden = MASTER_TAG_LABELS.filter(
          (label) => !COMMON_TAG_LABELS.includes(label),
        );
        if (seedHidden.length > 0) {
          await saveHiddenTags(seedHidden);
        }
      }
      if (typeof opts.samplesRequested === 'boolean') {
        await saveSamplesRequested(opts.samplesRequested);
        if (opts.samplesRequested && contacts.length === 0) {
          const samples = getSampleContacts(addDays, isoToday);
          commit(samples);
        }
      }
      setOnboarded(true);
      try {
        await storage.set('crm-onboarded', 'true');
      } catch (_) {}
    },
    [
      contacts.length,
      commit,
      saveUseType,
      saveSamplesRequested,
      saveHiddenTags,
      hiddenTags.length,
    ],
  );

  const resetOnboarding = async () => {
    setOnboarded(false);
    try {
      await storage.set('crm-onboarded', 'false');
    } catch (_) {}
  };

  const activeContacts = contacts.filter((c) => !c.archived);
  const archivedContacts = contacts.filter((c) => c.archived);
  const overdueN = activeContacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek);
    return nd && daysUntil(nd) < 0;
  }).length;

  // ---------- Tier derived state ----------
  // Defaults to 'free' if profile hasn't loaded yet — fail closed, not open.
  // This means the AI counter is conservative during first-load: better to
  // briefly show "5 of 5 used" than to let a free user run unlimited calls
  // because we couldn't fetch their profile.
  const tier = profile?.tier || TIERS.FREE;
  const aiCallsCount = profile?.ai_calls_count || 0;
  const trialExpiresAt = profile?.trial_expires_at || null;
  const trialActive = isTrialActive(tier, trialExpiresAt);
  const trialDaysLeft = trialDaysRemaining(tier, trialExpiresAt);
  // Effective tier for feature gating: trial behaves like pro until it expires.
  const effectiveTier = trialActive ? TIERS.TRIAL : tier;
  const aiRemaining = aiCallsRemaining(effectiveTier, aiCallsCount);
  const canUseAi = canMakeAiCall(effectiveTier, aiCallsCount);

  // Helper exposed to components: check a feature by key.
  // e.g. featureUnlocked('granolaAiProcessing') -> false on free, true on pro
  function featureUnlocked(key) {
    return isFeatureUnlocked(effectiveTier, key);
  }

  // ---------- AI usage actions ----------
  // Wrapper for AI calls. Components call this BEFORE invoking the AI;
  // returns true if the call is allowed (and increments the counter as a
  // side effect for free users), false if blocked.
  // If blocked, sets paywallReason so the upgrade modal renders.
  const consumeAiCall = useCallback(
    async (reason = 'ai_limit_reached') => {
      if (!canMakeAiCall(effectiveTier, aiCallsCount)) {
        setPaywallReason(reason);
        return false;
      }
      // Pro / trial: unlimited, no counter increment needed.
      if (effectiveTier !== TIERS.FREE) return true;
      // Free: increment counter. Update local state optimistically, then
      // persist. If persist fails, log but allow the call (Optimistic UX).
      try {
        const updated = await incrementAiCounter();
        setProfile(updated);
      } catch (e) {
        console.warn('AI counter increment failed:', e?.message);
        // Optimistic local fallback so the UI still updates
        setProfile((p) => (p ? { ...p, ai_calls_count: (p.ai_calls_count || 0) + 1 } : p));
      }
      return true;
    },
    [effectiveTier, aiCallsCount],
  );

  const dismissPaywall = useCallback(() => setPaywallReason(null), []);

  // Trigger paywall manually (e.g. user tapped a locked Pro feature button).
  const showPaywall = useCallback((reason = 'pro_feature') => {
    setPaywallReason(reason);
  }, []);

  return {
    contacts,
    activeContacts,
    archivedContacts,
    overdueN,
    myCard,
    customTags,
    hiddenTags,
    customInterests,
    hiddenInterests,
    allTags,
    visibleTags,
    allInterests,
    visibleInterests,
    pin,
    displayName,
    username,
    password,
    onboarded,
    useType,
    samplesRequested,
    samplesBannerDismissed,
    mailingLists,
    reviewQueue,
    loaded,
    saving,
    contactsFetchError,
    contactsFetching,
    refetchContacts,
    // ---------- Tier / subscription ----------
    profile,
    profileLoading,
    refetchProfile,
    tier,
    effectiveTier,
    aiCallsCount,
    aiRemaining,
    canUseAi,
    trialActive,
    trialDaysLeft,
    featureUnlocked,
    consumeAiCall,
    paywallReason,
    showPaywall,
    dismissPaywall,
    commit,
    saveMyCard,
    saveCustomTags,
    saveHiddenTags,
    addCustomTag,
    saveCustomInterests,
    saveHiddenInterests,
    addCustomInterest,
    savePin,
    removePin,
    saveDisplayName,
    saveUsername,
    savePassword,
    saveUseType,
    saveSamplesRequested,
    clearSampleContacts,
    dismissSamplesBanner,
    createMailingList,
    renameMailingList,
    deleteMailingList,
    setAddressOverride,
    toggleContactOnList,
    addToReviewQueue,
    removeFromReviewQueue,
    patchReviewQueueItem,
    clearReviewQueue,
    finishOnboarding,
    resetOnboarding,
  };
}