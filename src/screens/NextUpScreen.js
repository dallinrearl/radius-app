import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../styles/theme';
import { Avatar, TagPill } from '../components/Common';
import { CalendarIcon, ChevronLeft, ChevronRight, RefreshIcon } from '../components/Icons';
import { nextDate, daysUntil, fmtShort, addDays, isoToday, fmtDate } from '../utils/helpers';
import { aiSuggestOutreaches } from '../utils/ai';

const AI_CACHE_KEY = 'crm-ai-outreach-cache';
const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export default function NextUpScreen({
  activeContacts,
  allTags,
  onPickContact,
  onLogTouch,
  onSnooze,
  // AI mode props
  myCard,
  aiUnlocked,
  consumeAiCall,
  onShowPaywall,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('list');
  const [tagFilter, setTagFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // AI suggestions state. Cached locally for 24h to avoid burning tokens.
  const [aiSuggestions, setAiSuggestions] = useState(null); // null = not loaded
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCachedAt, setAiCachedAt] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Load cached AI suggestions on mount.
  useEffect(() => {
    (async () => {
      try {
        const r = await AsyncStorage.getItem(AI_CACHE_KEY);
        if (r) {
          const parsed = JSON.parse(r);
          if (parsed && Array.isArray(parsed.suggestions) && parsed.cachedAt) {
            const age = Date.now() - parsed.cachedAt;
            if (age < AI_CACHE_TTL_MS) {
              setAiSuggestions(parsed.suggestions);
              setAiCachedAt(parsed.cachedAt);
            }
          }
        }
      } catch (_) {
        // Cache load failure is non-fatal
      }
    })();
  }, []);

  // Run AI suggestions. Called from button tap. Consumes 1 AI call.
  async function runAiSuggestions(force = false) {
    if (aiLoading) return;
    // Free users: paywall
    if (!aiUnlocked) {
      onShowPaywall && onShowPaywall('ai_outreaches');
      return;
    }
    // Use cache if available and not forcing refresh
    if (!force && aiSuggestions && aiCachedAt) {
      const age = Date.now() - aiCachedAt;
      if (age < AI_CACHE_TTL_MS) return;
    }

    // Ask for permission to consume an AI call. Returns false if user is
    // free-tier and at the cap (paywall fires inside the store).
    const ok = await (consumeAiCall ? consumeAiCall('ai_limit_reached') : Promise.resolve(true));
    if (!ok) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const results = await aiSuggestOutreaches({ contacts: activeContacts, myCard });
      setAiSuggestions(results);
      const now = Date.now();
      setAiCachedAt(now);
      try {
        await AsyncStorage.setItem(
          AI_CACHE_KEY,
          JSON.stringify({ suggestions: results, cachedAt: now }),
        );
      } catch (_) {}
    } catch (e) {
      console.error('runAiSuggestions failed:', e?.message);
      setAiError(e?.message || 'Could not load suggestions');
    }
    setAiLoading(false);
  }

  // Dismiss a single AI suggestion. Removes it from local state and updates
  // the cached list so it stays gone until next AI refresh. Lightweight —
  // no API call, no AI quota cost.
  async function dismissAiSuggestion(contactId) {
    const next = (aiSuggestions || []).filter((s) => s.contactId !== contactId);
    setAiSuggestions(next);
    try {
      await AsyncStorage.setItem(
        AI_CACHE_KEY,
        JSON.stringify({ suggestions: next, cachedAt: aiCachedAt || Date.now() }),
      );
    } catch (_) {}
  }

  const upcoming = useMemo(() => {
    return activeContacts
      .filter((c) => {
        const nd = nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek);
        if (!nd) return false;
        if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
        return true;
      })
      .map((c) => ({
        contact: c,
        date: nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [activeContacts, tagFilter]);

  const overdue = upcoming.filter((x) => daysUntil(x.date) < 0);
  const today = upcoming.filter((x) => daysUntil(x.date) === 0);
  const week = upcoming.filter((x) => {
    const d = daysUntil(x.date);
    return d > 0 && d <= 7;
  });
  const month = upcoming.filter((x) => {
    const d = daysUntil(x.date);
    return d > 7 && d <= 30;
  });
  const later = upcoming.filter((x) => daysUntil(x.date) > 30);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          backgroundColor: theme.navBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.brd,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 18,
                color: theme.t1,
                fontWeight: '700',
                fontFamily: theme.fontDisplay,
              }}
            >
              Next Up
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: theme.gold,
                marginTop: 2,
                letterSpacing: 0.3,
              }}
            >
              {upcoming.length} upcoming
            </Text>
          </View>
          {/* List/Calendar toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.bg2,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.brd2,
              overflow: 'hidden',
            }}
          >
            {['list', 'calendar'].map((v) => {
              const on = view === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setView(v)}
                  style={{
                    minWidth: 90,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    backgroundColor: on ? theme.ac : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: on ? theme.bg : theme.t5,
                      textTransform: 'capitalize',
                    }}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Tag filter band — sits below the header divider in its own
          section, matching the Contacts tab visual height. */}
      {(allTags || []).length > 0 && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: theme.bg,
            borderBottomWidth: 1,
            borderBottomColor: theme.brd,
          }}
        >
          <TagFilterBar
            theme={theme}
            allTags={allTags}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
          />
        </View>
      )}

      {view === 'list' ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {/* AI suggestions section: appears at the top whenever AI has
              returned results. Sits above all manual groups. */}
          {aiSuggestions && aiSuggestions.length > 0 && (
            <AiSuggestionsSection
              theme={theme}
              suggestions={aiSuggestions}
              contacts={activeContacts}
              cachedAt={aiCachedAt}
              onPickContact={onPickContact}
              onLogTouch={onLogTouch}
              onDismiss={dismissAiSuggestion}
            />
          )}

          {/* AI loading/error inline at top, only when there are also
              manual items below. Otherwise the empty-state component
              owns the loading/error display. */}
          {(aiLoading || aiError) && upcoming.length > 0 && (
            <View
              style={{
                backgroundColor: theme.bg2,
                borderWidth: 1,
                borderColor: theme.brd,
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                alignItems: 'center',
              }}
            >
              {aiLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={theme.ac} size="small" />
                  <Text style={{ fontSize: 12, color: theme.t5 }}>
                    Looking for who to reach out to...
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: theme.red }}>
                  AI suggestions failed: {aiError}
                </Text>
              )}
            </View>
          )}

          {!upcoming.length && (
            <View style={{ alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 }}>
              <CalendarIcon size={56} color={theme.t6} strokeWidth={1.2} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.t2, marginTop: 16 }}>
                Nothing scheduled
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.t6,
                  marginTop: 6,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                Set follow-up frequencies on your contacts to{'\n'}see them here.
              </Text>
              {/* For Pro/trial users, nudge toward AI suggestions as a faster
                  path to value than manually configuring every contact.
                  Triggers the same call as the floating button. */}
              {aiUnlocked && !aiLoading && !aiSuggestions?.length && (
                <TouchableOpacity
                  onPress={() => runAiSuggestions(true)}
                  disabled={aiLoading}
                  style={{
                    marginTop: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: theme.bgAc,
                    borderWidth: 1,
                    borderColor: theme.brdAc,
                  }}
                >
                  <Text style={{ color: theme.ac, fontSize: 12, fontWeight: '600' }}>
                    Get AI suggestions ✦
                  </Text>
                </TouchableOpacity>
              )}
              {/* Loading state shown right where the button was */}
              {aiLoading && (
                <View
                  style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <ActivityIndicator color={theme.ac} size="small" />
                  <Text style={{ fontSize: 12, color: theme.t5 }}>
                    Looking for who to reach out to...
                  </Text>
                </View>
              )}
              {aiError && (
                <Text style={{ marginTop: 12, fontSize: 12, color: theme.red, textAlign: 'center' }}>
                  {aiError}
                </Text>
              )}
            </View>
          )}
          {!!overdue.length && (
            <Group label="Overdue" color={theme.red} count={overdue.length}>
              {overdue.map((x) => (
                <NextUpRow
                  key={x.contact.id}
                  item={x}
                  onPress={() => onPickContact(x.contact)}
                  onLog={() => onLogTouch(x.contact)}
                  onSnooze={(d) => onSnooze(x.contact, d)}
                  theme={theme}
                />
              ))}
            </Group>
          )}
          {!!today.length && (
            <Group label="Today" color={theme.warn} count={today.length}>
              {today.map((x) => (
                <NextUpRow
                  key={x.contact.id}
                  item={x}
                  onPress={() => onPickContact(x.contact)}
                  onLog={() => onLogTouch(x.contact)}
                  onSnooze={(d) => onSnooze(x.contact, d)}
                  theme={theme}
                />
              ))}
            </Group>
          )}
          {!!week.length && (
            <Group label="This Week" color={theme.ac} count={week.length}>
              {week.map((x) => (
                <NextUpRow
                  key={x.contact.id}
                  item={x}
                  onPress={() => onPickContact(x.contact)}
                  onLog={() => onLogTouch(x.contact)}
                  onSnooze={(d) => onSnooze(x.contact, d)}
                  theme={theme}
                />
              ))}
            </Group>
          )}
          {!!month.length && (
            <Group label="This Month" color={theme.info} count={month.length}>
              {month.map((x) => (
                <NextUpRow
                  key={x.contact.id}
                  item={x}
                  onPress={() => onPickContact(x.contact)}
                  onLog={() => onLogTouch(x.contact)}
                  onSnooze={(d) => onSnooze(x.contact, d)}
                  theme={theme}
                />
              ))}
            </Group>
          )}
          {!!later.length && (
            <Group label="Later" color={theme.t4} count={later.length}>
              {later.map((x) => (
                <NextUpRow
                  key={x.contact.id}
                  item={x}
                  onPress={() => onPickContact(x.contact)}
                  onLog={() => onLogTouch(x.contact)}
                  onSnooze={(d) => onSnooze(x.contact, d)}
                  theme={theme}
                />
              ))}
            </Group>
          )}
        </ScrollView>
      ) : (
        <CalendarView upcoming={upcoming} onPickContact={onPickContact} />
      )}

      {/* Floating AI button. Hidden in Calendar view (AI suggestions don't
          have dates so they don't fit on the calendar grid). Tapping it
          either runs AI suggestions or opens the paywall for free users.
          Visual state changes when suggestions are already loaded — becomes
          a refresh action rather than an initial fetch. */}
      {view === 'list' && (
        <TouchableOpacity
          onPress={() => runAiSuggestions(true)}
          activeOpacity={0.85}
          disabled={aiLoading}
          style={{
            position: 'absolute',
            right: 18,
            bottom: 90,
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: aiUnlocked ? theme.ac : theme.t4,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 6,
            opacity: aiLoading ? 0.7 : 1,
          }}
        >
          {aiLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : !aiUnlocked ? (
            <Text style={{ fontSize: 22, color: '#fff' }}>🔒</Text>
          ) : (
            <Text style={{ fontSize: 22, color: '#fff', fontWeight: '700' }}>✦</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

// TagFilterBar — auto-fit inline tag pills with overflow ☰ button.
//
// How it fits: measures the row container with onLayout, then estimates each
// pill's width from its label (approx 6.4px per char + 26px padding + 6px gap).
// Walks pills in order, packing as many as fit alongside the ☰ button (the ☰
// only renders when there's overflow, but we reserve its width up front so
// the layout doesn't jump when it appears).
//
// Trade-off: char-width estimation isn't pixel-perfect across fonts, so we
// leave a small safety margin. If a pill is borderline it goes in the menu.
function TagFilterBar({
  theme,
  allTags,
  tagFilter,
  setTagFilter,
  filterOpen,
  setFilterOpen,
}) {
  const [rowWidth, setRowWidth] = useState(0);
  // Estimated widths in px. fontSize 10, fontWeight 600.
  // 4.8 px/char is calibrated against the actual rendered width of common
  // tag labels (Friend, Colleague, Mentor, Client, Vendor/Supplier). Bump up
  // if you see clipping in production.
  const pillFor = (label) => Math.ceil(label.length * 4.8) + 22;
  const ALL_WIDTH = pillFor('All');
  const MENU_WIDTH = 38; // ☰ button
  const GAP = 6;
  const SAFETY = 2;

  // Decide which tags fit inline. Always reserve space for ☰ if there are
  // any tags (we only know if all fit AFTER measuring, so reserve to avoid
  // jumpy layout).
  const inlineTags = [];
  const overflowTags = [];
  if (rowWidth > 0) {
    let used = ALL_WIDTH + GAP + MENU_WIDTH + SAFETY;
    for (const t of allTags) {
      const w = pillFor(t) + GAP;
      if (used + w <= rowWidth) {
        inlineTags.push(t);
        used += w;
      } else {
        overflowTags.push(t);
      }
    }
  }

  // If selected tag is in overflow, surface it inline so user can see it
  // active. Bump out the last inline tag to make room.
  if (tagFilter && overflowTags.includes(tagFilter)) {
    overflowTags.splice(overflowTags.indexOf(tagFilter), 1);
    if (inlineTags.length > 0) {
      const bumped = inlineTags.pop();
      overflowTags.unshift(bumped);
    }
    inlineTags.push(tagFilter);
  }

  const hasOverflow = overflowTags.length > 0;

  const PillTag = ({ label, on, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: on ? theme.ac + '22' : 'transparent',
        borderColor: on ? theme.ac : theme.brd2,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          color: on ? theme.ac : theme.t5,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <View
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: GAP,
        }}
      >
        <PillTag label="All" on={!tagFilter} onPress={() => setTagFilter('')} />
        {inlineTags.map((t) => (
          <PillTag
            key={t}
            label={t}
            on={tagFilter === t}
            onPress={() => setTagFilter(tagFilter === t ? '' : t)}
          />
        ))}
        {hasOverflow && (
          <TouchableOpacity
            onPress={() => setFilterOpen((o) => !o)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              width: MENU_WIDTH - GAP,
              paddingVertical: 5,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: filterOpen ? theme.ac : theme.brd2,
              backgroundColor: filterOpen ? theme.bgAc : theme.bg2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: filterOpen ? theme.ac : theme.t4,
                fontWeight: '700',
                lineHeight: 14,
              }}
            >
              ☰
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Overflow drawer — only the tags that didn't fit inline. */}
      {filterOpen && hasOverflow && (
        <View
          style={{
            marginTop: 8,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {overflowTags.map((t) => (
            <PillTag
              key={t}
              label={t}
              on={tagFilter === t}
              onPress={() => {
                setTagFilter(tagFilter === t ? '' : t);
                setFilterOpen(false);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Group({ label, color, count, children }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: theme.t5 }}>({count})</Text>
      </View>
      {children}
    </View>
  );
}

function NextUpRow({ item, onPress, onLog, onSnooze, theme }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showSnooze, setShowSnooze] = React.useState(false);
  const d = daysUntil(item.date);
  const isOverdue = d < 0;
  const isToday = d === 0;
  const badge = isOverdue
    ? Math.abs(d) + 'd late'
    : isToday
      ? 'Today'
      : d === 1
        ? 'Tmrw'
        : d + 'd';
  const bc = isOverdue ? theme.red : isToday ? theme.warn : d <= 7 ? theme.ac : theme.t5;

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        borderRadius: 10,
        marginBottom: 6,
        overflow: 'hidden',
      }}
    >
      {/* Slim single-line row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
        }}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <Avatar contact={item.contact} size={28} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 13, color: theme.t1, fontWeight: '600' }}
              numberOfLines={1}
            >
              {item.contact.name}
            </Text>
            <Text style={{ fontSize: 10, color: theme.t5 }} numberOfLines={1}>
              {item.contact.role}
              {item.contact.role && item.contact.company ? ' · ' : ''}
              {item.contact.company}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: bc }}>{badge}</Text>
            <Text style={{ fontSize: 9, color: theme.t6 }}>{fmtShort(item.date)}</Text>
          </View>
        </TouchableOpacity>
        {/* Actions dropdown trigger */}
        <TouchableOpacity
          onPress={() => {
            setMenuOpen((m) => !m);
            setShowSnooze(false);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: menuOpen ? theme.ac : theme.brd2,
            backgroundColor: menuOpen ? theme.bgAc : theme.bg3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: menuOpen ? theme.ac : theme.t4,
              fontWeight: '600',
            }}
          >
            Actions
          </Text>
          <Text
            style={{
              fontSize: 9,
              color: menuOpen ? theme.ac : theme.t4,
              marginTop: 1,
            }}
          >
            {menuOpen ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action menu (collapsed by default) */}
      {menuOpen && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.brd,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          {!showSnooze ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  onLog();
                  setMenuOpen(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: theme.bgAc,
                  borderWidth: 1,
                  borderColor: theme.brdAc,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>Log</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSnooze(true)}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  backgroundColor: theme.bg3,
                  borderWidth: 1,
                  borderColor: theme.brd2,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '600' }}>Snooze</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[
                { d: 1, l: '+1d' },
                { d: 3, l: '+3d' },
                { d: 7, l: '+1w' },
                { d: 14, l: '+2w' },
                { d: 30, l: '+1mo' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.d}
                  onPress={() => {
                    onSnooze(s.d);
                    setShowSnooze(false);
                    setMenuOpen(false);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 7,
                    backgroundColor: theme.bg3,
                    borderWidth: 1,
                    borderColor: theme.brd2,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: theme.t4, fontSize: 10, fontWeight: '600' }}>{s.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// AiSuggestionsSection — renders AI suggestions as a top section in the
// Next Up list, above the manual groups. No standalone scroll, no full-page
// loading/error states (those live in the parent because they need to
// coexist with the manual list below).
function AiSuggestionsSection({
  theme,
  suggestions,
  contacts,
  cachedAt,
  onPickContact,
  onLogTouch,
  onDismiss,
}) {
  // Resolve contactId → full contact for rendering rows.
  const byId = useMemo(() => {
    const m = new Map();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  const cachedAgeText = (() => {
    if (!cachedAt) return '';
    const ageMin = Math.floor((Date.now() - cachedAt) / 60000);
    if (ageMin < 1) return 'just now';
    if (ageMin < 60) return ageMin + 'm ago';
    const ageH = Math.floor(ageMin / 60);
    if (ageH < 24) return ageH + 'h ago';
    return Math.floor(ageH / 24) + 'd ago';
  })();

  const visible = (suggestions || []).filter((s) => byId.get(s.contactId));
  if (visible.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      {/* Section header. Same vibe as manual group headers but with the
          AI sparkle and an updated-time stamp instead of a count. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 12 }}>✦</Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.ac,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          AI Suggestions
        </Text>
        {cachedAgeText ? (
          <Text style={{ fontSize: 10, color: theme.t6 }}>{cachedAgeText}</Text>
        ) : null}
      </View>
      {visible.map((s) => {
        const contact = byId.get(s.contactId);
        return (
          <AiSuggestionRow
            key={s.contactId}
            suggestion={s}
            contact={contact}
            theme={theme}
            onPress={() => onPickContact(contact)}
            onLog={() => onLogTouch(contact)}
            onDismiss={() => onDismiss(s.contactId)}
          />
        );
      })}
    </View>
  );
}

function AiSuggestionRow({ suggestion, contact, theme, onPress, onLog, onDismiss }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Color by urgency
  const urgencyColor =
    suggestion.urgency === 'high'
      ? theme.red
      : suggestion.urgency === 'medium'
        ? theme.warn
        : theme.t5;
  const urgencyLabel =
    suggestion.urgency === 'high'
      ? 'High'
      : suggestion.urgency === 'medium'
        ? 'Medium'
        : 'Low';

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Top row: contact + urgency */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <Avatar contact={contact} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, color: theme.t1, fontWeight: '600' }} numberOfLines={1}>
            {contact.name}
          </Text>
          <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
            {contact.role}
            {contact.role && contact.company ? ' · ' : ''}
            {contact.company}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: urgencyColor + '22',
            borderWidth: 1,
            borderColor: urgencyColor + '50',
          }}
        >
          <Text style={{ color: urgencyColor, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
            {urgencyLabel.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Reason + suggested action */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <Text
          style={{ fontSize: 12, color: theme.t3, lineHeight: 17, marginBottom: 4 }}
        >
          {suggestion.reason}
        </Text>
        {suggestion.suggestedAction ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 6,
              marginTop: 4,
              paddingTop: 6,
              borderTopWidth: 1,
              borderTopColor: theme.brd,
            }}
          >
            <Text style={{ fontSize: 11, color: theme.ac, fontWeight: '700' }}>→</Text>
            <Text style={{ flex: 1, fontSize: 11, color: theme.t4, lineHeight: 16 }}>
              {suggestion.suggestedAction}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions dropdown */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingBottom: 10,
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        <TouchableOpacity
          onPress={() => setMenuOpen((m) => !m)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: menuOpen ? theme.ac : theme.brd2,
            backgroundColor: menuOpen ? theme.bgAc : theme.bg3,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: menuOpen ? theme.ac : theme.t4,
              fontWeight: '600',
            }}
          >
            Actions
          </Text>
          <Text
            style={{
              fontSize: 9,
              color: menuOpen ? theme.ac : theme.t4,
              marginTop: 1,
            }}
          >
            {menuOpen ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      </View>
      {menuOpen && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.brd,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                onLog();
                setMenuOpen(false);
              }}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: theme.bgAc,
                borderWidth: 1,
                borderColor: theme.brdAc,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                onDismiss();
                setMenuOpen(false);
              }}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: theme.bg3,
                borderWidth: 1,
                borderColor: theme.brd2,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '600' }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function CalendarView({ upcoming, onPickContact }) {
  const { theme } = useTheme();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  // Selected day cell (ISO string) — tap a day to filter the events list
  // below to just that day. null = show whole month (default).
  const [selectedDay, setSelectedDay] = useState(null);

  // Reset selection when month changes so we don't carry over a stale day.
  useEffect(() => {
    setSelectedDay(null);
  }, [month.y, month.m]);

  const monthName = new Date(month.y, month.m, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const firstDay = new Date(month.y, month.m, 1).getDay();
  const numDays = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function getEventsForDay(d) {
    if (!d) return [];
    const dStr =
      month.y +
      '-' +
      String(month.m + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0');
    return upcoming.filter((x) => x.date === dStr);
  }

  function shift(n) {
    setMonth((p) => {
      let m = p.m + n;
      let y = p.y;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { y, m };
    });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <TouchableOpacity onPress={() => shift(-1)} style={{ padding: 8 }}>
          <ChevronLeft size={18} color={theme.t3} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 16,
            color: theme.t1,
            fontWeight: '600',
            fontFamily: theme.fontDisplay,
          }}
        >
          {monthName}
        </Text>
        <TouchableOpacity onPress={() => shift(1)} style={{ padding: 8 }}>
          <ChevronRight size={18} color={theme.t3} />
        </TouchableOpacity>
      </View>
      {/* Weekday header */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              color: theme.t5,
              fontWeight: '700',
            }}
          >
            {w}
          </Text>
        ))}
      </View>
      {/* Cells */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          const events = getEventsForDay(d);
          const today = isoToday();
          const cellDate =
            d &&
            month.y +
              '-' +
              String(month.m + 1).padStart(2, '0') +
              '-' +
              String(d).padStart(2, '0');
          const isToday = cellDate === today;
          const isSelected = cellDate && cellDate === selectedDay;
          return (
            <View
              key={i}
              style={{
                width: '14.285%',
                height: 60,
                padding: 2,
              }}
            >
              {d && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    setSelectedDay((curr) => (curr === cellDate ? null : cellDate))
                  }
                  style={{
                    flex: 1,
                    backgroundColor: isSelected
                      ? theme.ac + '33'
                      : isToday
                        ? theme.bgAc
                        : theme.bg2,
                    borderRadius: 8,
                    borderWidth: isSelected || isToday ? 1 : 0,
                    borderColor: isSelected
                      ? theme.ac
                      : isToday
                        ? theme.ac
                        : 'transparent',
                    padding: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: isSelected || isToday ? theme.ac : theme.t4,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    }}
                  >
                    {d}
                  </Text>
                  {events.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2 }}>
                      {events.slice(0, 3).map((e, j) => (
                        <View
                          key={j}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: theme.ac,
                          }}
                        />
                      ))}
                      {events.length > 3 && (
                        <Text style={{ fontSize: 7, color: theme.t5 }}>+{events.length - 3}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Events list — filtered by selected day if one is tapped, else
          shows everything in the visible month. */}
      <View style={{ marginTop: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: theme.ac,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {selectedDay ? 'Events on ' + fmtDate(selectedDay) : 'Events This Month'}
          </Text>
          {selectedDay && (
            <TouchableOpacity onPress={() => setSelectedDay(null)}>
              <Text style={{ fontSize: 10, color: theme.t5, fontWeight: '600' }}>
                Show all
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {(() => {
          const filtered = upcoming.filter((x) => {
            if (selectedDay) return x.date === selectedDay;
            const d = new Date(x.date + 'T12:00:00');
            return d.getMonth() === month.m && d.getFullYear() === month.y;
          });
          if (filtered.length === 0) {
            return (
              <Text style={{ fontSize: 12, color: theme.t6, paddingVertical: 8 }}>
                {selectedDay
                  ? 'No follow-ups scheduled for this day.'
                  : 'No follow-ups this month.'}
              </Text>
            );
          }
          return filtered.map((x) => (
            <TouchableOpacity
              key={x.contact.id}
              onPress={() => onPickContact(x.contact)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                marginBottom: 6,
                backgroundColor: theme.bg2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.brd,
              }}
            >
              <Avatar contact={x.contact} size={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500' }}>
                  {x.contact.name}
                </Text>
                <Text style={{ fontSize: 10, color: theme.t5 }}>{fmtDate(x.date)}</Text>
              </View>
            </TouchableOpacity>
          ));
        })()}
      </View>
    </ScrollView>
  );
}