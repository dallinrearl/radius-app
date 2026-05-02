import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';
import { isoToday, addDays, nextDate, daysUntil } from '../utils/helpers';
import { EMPTY_CONTACT, getSampleContacts, DEFAULT_TAGS, DEFAULT_INTERESTS } from '../constants';

export function useAppStore() {
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
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load all data on mount
  useEffect(() => {
    (async () => {
      let loaded_contacts = null;
      try {
        const r = await storage.get('crm-contacts');
        if (r?.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed) && parsed.length > 0) loaded_contacts = parsed;
        }
      } catch (_) {}
      setContacts(loaded_contacts || getSampleContacts(addDays, isoToday));

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
      setLoaded(true);
    })();
  }, []);

  const persistContacts = useCallback(async (d) => {
    setSaving(true);
    try {
      await storage.set('crm-contacts', JSON.stringify(d));
    } catch (_) {}
    setSaving(false);
  }, []);

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

  const allTags = [...DEFAULT_TAGS, ...customTags];
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
  const finishOnboarding = async () => {
    setOnboarded(true);
    try {
      await storage.set('crm-onboarded', 'true');
    } catch (_) {}
  };
  const resetOnboarding = async () => {
    setOnboarded(false);
    try {
      await storage.set('crm-onboarded', 'false');
    } catch (_) {}
  };

  const activeContacts = contacts.filter((c) => !c.archived);
  const archivedContacts = contacts.filter((c) => c.archived);
  const overdueN = activeContacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq);
    return nd && daysUntil(nd) < 0;
  }).length;

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
    loaded,
    saving,
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
    finishOnboarding,
    resetOnboarding,
  };
}
