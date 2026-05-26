import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';
import { supabase } from '../lib/supabase';
import {
  fetchContacts,
  syncContacts,
  deleteContact as deleteContactApi,
  deleteContacts as deleteContactsApi,
  isSampleContact,
} from '../lib/contactsApi';
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
import {
  mergeQueue,
  removeFromQueue,
  updateQueueItem,
  migrateUserAsAttendee,
} from '../utils/reviewQueue';
import { SUMMARY_LENGTH_OPTIONS, DEFAULT_SUMMARY_LENGTH } from '../utils/ai';
import {
  registerForPushNotifications,
  clearPushNotificationToken,
} from '../utils/notifications';

const MASTER_TAG_LABELS = MASTER_TAGS.map((t) => t.label);

const HOLIDAY_LIST_ID = 'holiday_card_list';

const REVIEW_QUEUE_STORAGE = 'crm-review-queue';
const QUEUE_MIGRATION_DONE_KEY = 'crm-queue-migration-self-attendee-done-v1';

// AsyncStorage key for the meeting-summary length preference.
const MEETING_SUMMARY_LENGTH_KEY = 'crm-meeting-summary-length';

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
  const [samplesBannerDismissed, setSamplesBannerDismissedState] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);

  const [meetingSummaryLength, setMeetingSummaryLengthState] = useState(DEFAULT_SUMMARY_LENGTH);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactsFetchError, setContactsFetchError] = useState(null);
  const [contactsFetching, setContactsFetching] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
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

  const refetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      let p = await fetchProfile();
      if (p && shouldResetAiCounter(p.ai_calls_reset_at)) {
        try {
          p = await resetAiCounter();
        } catch (e) {
          console.warn('AI counter reset failed:', e?.message);
        }
      }
      setProfile(p);
    } catch (e) {
      console.warn('refetchProfile error:', e?.message);
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
      let loadedMyCard = null;
      try {
        const r = await storage.get('crm-mycard');
        if (r?.value) {
          loadedMyCard = JSON.parse(r.value);
          setMyCard(loadedMyCard);
        }
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
        const r = await storage.get(MEETING_SUMMARY_LENGTH_KEY);
        if (r?.value && SUMMARY_LENGTH_OPTIONS[r.value]) {
          setMeetingSummaryLengthState(r.value);
        }
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
        let parsed = [];
        if (r?.value) {
          try {
            const v = JSON.parse(r.value);
            if (Array.isArray(v)) parsed = v;
          } catch (_) {}
        }

        const migrationDone = await storage.get(QUEUE_MIGRATION_DONE_KEY);
        if (migrationDone?.value !== 'true' && parsed.length > 0) {
          const { migrated, changedCount } = migrateUserAsAttendee(parsed, loadedMyCard);
          if (changedCount > 0) {
            console.log(
              `[Veery] One-time queue migration: rewrote ${changedCount} self-attendee item${changedCount === 1 ? '' : 's'} as no-name.`,
            );
            parsed = migrated;
            try {
              await storage.set(REVIEW_QUEUE_STORAGE, JSON.stringify(parsed));
            } catch (_) {}
          }
          try {
            await storage.set(QUEUE_MIGRATION_DONE_KEY, 'true');
          } catch (_) {}
        }

        setReviewQueue(parsed);
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

  // Remove a single contact. Updates local state immediately, then issues
  // a targeted cloud delete. Use this for any intentional contact deletion
  // — never delete-by-omission via commit(filter), because syncContacts
  // is upsert-only and won't propagate the removal.
  const removeContact = useCallback(
    async (id) => {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      if (!userId) return;
      try {
        const result = await deleteContactApi(id);
        if (!result.ok) {
          console.error('removeContact failed:', result.message);
        }
      } catch (e) {
        console.error('removeContact error:', e);
      }
    },
    [userId],
  );

  // Wipe every non-sample contact. Used by the Settings "Delete all contacts"
  // action. Samples are local-only and stay.
  const removeAllNonSampleContacts = useCallback(async () => {
    const realIds = contacts.filter((c) => !isSampleContact(c)).map((c) => c.id);
    setContacts((prev) => prev.filter(isSampleContact));
    if (!userId || realIds.length === 0) return;
    try {
      const result = await deleteContactsApi(realIds);
      if (!result.ok) {
        console.error('removeAllNonSampleContacts failed:', result.message);
      }
    } catch (e) {
      console.error('removeAllNonSampleContacts error:', e);
    }
  }, [contacts, userId]);

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

  const saveMeetingSummaryLength = useCallback(async (value) => {
    if (!SUMMARY_LENGTH_OPTIONS[value]) {
      console.warn('saveMeetingSummaryLength: invalid value', value);
      return;
    }
    setMeetingSummaryLengthState(value);
    try {
      await storage.set(MEETING_SUMMARY_LENGTH_KEY, value);
    } catch (_) {}
  }, []);

  // ---------- Push notifications ----------
  //
  // Three toggles live on the Supabase profiles row (not AsyncStorage)
  // because the server-side cron job needs to read them when deciding
  // whom to push to. Toggle UI in Settings reads/writes via the
  // saveNotificationPrefs callback below.
  //
  // registerPushToken runs the permission-request and token-registration
  // flow. Returns the status code so the caller can react (e.g., show a
  // "permission denied" message).

  const notificationsEnabled = !!profile?.notifications_enabled;
  const notifOverdue = !!profile?.notif_overdue;
  const notifBirthdays = !!profile?.notif_birthdays;
  const hasPushToken = !!profile?.expo_push_token;

  const saveNotificationPrefs = useCallback(
    async (patch) => {
      // patch is a partial object like { notifications_enabled: true }.
      // Optimistically update local profile state, then persist.
      setProfile((p) => (p ? { ...p, ...patch } : p));
      try {
        await updateProfile(patch);
      } catch (e) {
        console.warn('saveNotificationPrefs failed:', e?.message);
        await refetchProfile();
      }
    },
    [refetchProfile],
  );

  const registerPushToken = useCallback(async () => {
    const result = await registerForPushNotifications();
    if (result.status === 'ok') {
      await refetchProfile();
    }
    return result;
  }, [refetchProfile]);

  const removePushToken = useCallback(async () => {
    await clearPushNotificationToken();
    await refetchProfile();
  }, [refetchProfile]);

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

  const persistReviewQueue = useCallback(async (next) => {
    setReviewQueue(next);
    try {
      await storage.set(REVIEW_QUEUE_STORAGE, JSON.stringify(next));
    } catch (_) {}
  }, []);

  const addToReviewQueue = useCallback(
    async (newItems) => {
      if (!Array.isArray(newItems) || newItems.length === 0) return;
      const merged = mergeQueue(reviewQueue, newItems);
      await persistReviewQueue(merged);
    },
    [reviewQueue, persistReviewQueue],
  );

  const removeFromReviewQueue = useCallback(
    async (itemId) => {
      const next = removeFromQueue(reviewQueue, itemId);
      await persistReviewQueue(next);
    },
    [reviewQueue, persistReviewQueue],
  );

  const patchReviewQueueItem = useCallback(
    async (itemId, patch) => {
      const next = updateQueueItem(reviewQueue, itemId, patch);
      await persistReviewQueue(next);
    },
    [reviewQueue, persistReviewQueue],
  );

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

  const tier = profile?.tier || TIERS.FREE;
  const aiCallsCount = profile?.ai_calls_count || 0;
  const trialExpiresAt = profile?.trial_expires_at || null;
  const trialActive = isTrialActive(tier, trialExpiresAt);
  const trialDaysLeft = trialDaysRemaining(tier, trialExpiresAt);
  const effectiveTier = trialActive ? TIERS.TRIAL : tier;
  const aiRemaining = aiCallsRemaining(effectiveTier, aiCallsCount);
  const canUseAi = canMakeAiCall(effectiveTier, aiCallsCount);

  function featureUnlocked(key) {
    return isFeatureUnlocked(effectiveTier, key);
  }

  const consumeAiCall = useCallback(
    async (reason = 'ai_limit_reached') => {
      if (!canMakeAiCall(effectiveTier, aiCallsCount)) {
        setPaywallReason(reason);
        return false;
      }
      if (effectiveTier !== TIERS.FREE) return true;
      try {
        const updated = await incrementAiCounter();
        setProfile(updated);
      } catch (e) {
        console.warn('AI counter increment failed:', e?.message);
        setProfile((p) => (p ? { ...p, ai_calls_count: (p.ai_calls_count || 0) + 1 } : p));
      }
      return true;
    },
    [effectiveTier, aiCallsCount],
  );

  const dismissPaywall = useCallback(() => setPaywallReason(null), []);

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
    meetingSummaryLength,
    notificationsEnabled,
    notifOverdue,
    notifBirthdays,
    hasPushToken,
    loaded,
    saving,
    contactsFetchError,
    contactsFetching,
    refetchContacts,
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
    removeContact,
    removeAllNonSampleContacts,
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
    saveMeetingSummaryLength,
    saveNotificationPrefs,
    registerPushToken,
    removePushToken,
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