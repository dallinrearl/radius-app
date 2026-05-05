import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { Avatar, StrengthDot, TagPill } from '../components/Common';
import { BellIcon, FilterIcon, ChevronDown, UsersIcon } from '../components/Icons';
import SwipeDeleteCard from '../components/SwipeDeleteCard';
import {
  nextDate,
  daysUntil,
  fmtShort,
  getTagColor,
  daysSince,
  fmtDate,
} from '../utils/helpers';

export default function ContactsScreen({
  contacts,
  activeContacts,
  overdueN,
  allTags,
  onPickContact,
  onArchive,
  onLogTouch,
  onLogToday,
  showToast,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [ftag, setFtag] = useState('');
  const [sort, setSort] = useState('name');
  const [filterOpen, setFilterOpen] = useState(false);
  const [contactView, setContactView] = useState('individual');
  const [expandedCos, setExpandedCos] = useState({});
  const [showInbox, setShowInbox] = useState(false);

  const filtered = useMemo(() => {
    return activeContacts
      .filter((c) => {
        const s = q.toLowerCase();
        if (
          s &&
          !c.name.toLowerCase().includes(s) &&
          !(c.company || '').toLowerCase().includes(s) &&
          !(c.tags || []).some((t) => t.toLowerCase().includes(s))
        )
          return false;
        if (ftag && !(c.tags || []).includes(ftag)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'lastContacted')
          return (b.lastContacted || '').localeCompare(a.lastContacted || '');
        if (sort === 'added') return Number(b.id) - Number(a.id);
        if (sort === 'overdue') {
          const aN = nextDate(a.lastContacted, a.freq);
          const bN = nextDate(b.lastContacted, b.freq);
          return (aN || '9999').localeCompare(bN || '9999');
        }
        return 0;
      });
  }, [activeContacts, q, ftag, sort]);

  const sortLabels = {
    name: 'A-Z',
    lastContacted: 'Last contacted',
    added: 'Recently added',
    overdue: 'Most overdue',
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.navBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.brd,
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
            Contacts
          </Text>
          <Text style={{ fontSize: 11, color: theme.gold, marginTop: 2, letterSpacing: 0.3 }}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowInbox(!showInbox)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: showInbox ? theme.bgAc : theme.bg2,
              borderColor: showInbox ? theme.ac : theme.brd2,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <BellIcon size={18} color={showInbox ? theme.ac : theme.t4} />
            {overdueN > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: theme.red,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{overdueN}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Toggle */}
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
            {['individual', 'company'].map((v) => {
              const on = contactView === v;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setContactView(v)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    backgroundColor: on ? theme.ac : 'transparent',
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

      {/* Notification Inbox */}
      {showInbox && (
        <NotificationInbox
          contacts={activeContacts}
          onPickContact={(c) => {
            setShowInbox(false);
            onPickContact(c);
          }}
          onClose={() => setShowInbox(false)}
          onLogToday={onLogToday}
        />
      )}

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search + Filter Toggle */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search name, company, or tag..."
            placeholderTextColor={theme.t6}
            style={{
              flex: 1,
              backgroundColor: theme.bg2,
              borderWidth: 1,
              borderColor: theme.brd2,
              borderRadius: 12,
              color: theme.t1,
              paddingHorizontal: 14,
              paddingVertical: 11,
              fontSize: 14,
              fontFamily: theme.fontBody,
            }}
          />
          <TouchableOpacity
            onPress={() => setFilterOpen((o) => !o)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              borderWidth: 1,
              backgroundColor: filterOpen ? theme.bgAc : theme.bg2,
              borderColor: filterOpen ? theme.ac : theme.brd2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FilterIcon size={18} color={filterOpen ? theme.ac : theme.t4} />
          </TouchableOpacity>
        </View>

        {/* Filter Panel */}
        {filterOpen && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {['', ...allTags].map((t) => {
                const cnt = t
                  ? activeContacts.filter((c) => (c.tags || []).includes(t)).length
                  : activeContacts.length;
                const on = ftag === t;
                const c = t ? getTagColor(t) : theme.t5;
                return (
                  <TouchableOpacity
                    key={t || 'all'}
                    onPress={() => setFtag(ftag === t ? '' : t)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 20,
                      borderWidth: 1,
                      backgroundColor: on ? c + '22' : 'transparent',
                      borderColor: on ? c : theme.brd2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: on ? c : theme.t5,
                      }}
                    >
                      {t || 'All'}
                      {cnt > 0 ? ' (' + cnt + ')' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(sortLabels).map(([k, l]) => {
                const on = sort === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setSort(k)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: on ? theme.ac : theme.bg2,
                      borderWidth: 1,
                      borderColor: on ? theme.ac : theme.brd2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: on ? '#fff' : theme.t4,
                        fontWeight: '600',
                      }}
                    >
                      Sort: {l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Legend */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          {[
            { c: theme.red, l: 'Overdue' },
            { c: theme.warn, l: 'Due soon' },
            { c: theme.ac, l: 'On track' },
          ].map((x) => (
            <View key={x.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.c }} />
              <Text style={{ fontSize: 10, color: theme.t5 }}>{x.l}</Text>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {!filtered.length && (
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: theme.bg2,
                marginBottom: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UsersIcon size={36} color={activeContacts.length ? theme.t4 : theme.ac} strokeWidth={1.2} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.t2,
                marginBottom: 6,
              }}
            >
              {activeContacts.length ? 'No matches' : 'No contacts yet'}
            </Text>
            <Text style={{ fontSize: 13, color: theme.t6, textAlign: 'center', maxWidth: 260 }}>
              {activeContacts.length
                ? 'Try adjusting your search or filters.'
                : 'Tap the + button to add your first contact.'}
            </Text>
          </View>
        )}

        {/* Contact view */}
        {contactView === 'company'
          ? (() => {
              const groups = {};
              filtered.forEach((c) => {
                const key = (c.company || '').trim() || 'No Company';
                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
              });
              const sorted = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
              return sorted.map(([company, members]) => {
                const open = !!expandedCos[company];
                return (
                  <View key={company} style={{ marginBottom: 6 }}>
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedCos((p) => ({ ...p, [company]: !p[company] }))
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 14,
                        backgroundColor: theme.bg2,
                        borderWidth: 1,
                        borderColor: theme.brd,
                        borderRadius: open ? 0 : 14,
                        borderTopLeftRadius: 14,
                        borderTopRightRadius: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.t1 }}>
                          {company}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.t5 }}>{members.length}</Text>
                      </View>
                      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                        <ChevronDown size={14} color={theme.t5} />
                      </View>
                    </TouchableOpacity>
                    {open && (
                      <View
                        style={{
                          backgroundColor: theme.bg3,
                          borderWidth: 1,
                          borderColor: theme.brd,
                          borderTopWidth: 0,
                          borderBottomLeftRadius: 14,
                          borderBottomRightRadius: 14,
                          padding: 6,
                        }}
                      >
                        {members.map((c) => (
                          <ContactRow
                            key={c.id}
                            contact={c}
                            onPress={() => onPickContact(c)}
                            onLog={() => onLogTouch(c)}
                            onArchive={() => onArchive(c)}
                            theme={theme}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              });
            })()
          : filtered.map((c) => (
              <SwipeDeleteCard
                key={c.id}
                contactName={c.name}
                onDelete={() => onArchive(c)}
                onLog={() => onLogTouch(c)}
              >
                <ContactRowFull
                  contact={c}
                  onPress={() => onPickContact(c)}
                  theme={theme}
                />
              </SwipeDeleteCard>
            ))}
      </ScrollView>
    </View>
  );
}

function ContactRow({ contact, onPress, theme }) {
  const nd = nextDate(contact.lastContacted, contact.freq);
  const diff = nd ? daysUntil(nd) : null;
  const badge =
    diff !== null
      ? diff < 0
        ? Math.abs(diff) + 'd overdue'
        : diff === 0
          ? 'Today'
          : diff + 'd'
      : '';
  const bc = diff !== null ? (diff < 0 ? theme.red : diff <= 7 ? theme.warn : theme.ac) : theme.t5;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 10,
        backgroundColor: theme.bg3,
      }}
    >
      <View>
        <Avatar contact={contact} size={36} />
        <StrengthDot contact={contact} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500' }} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
          {contact.role}
        </Text>
      </View>
      {badge ? <Text style={{ fontSize: 10, fontWeight: '700', color: bc }}>{badge}</Text> : null}
    </TouchableOpacity>
  );
}

function ContactRowFull({ contact, onPress, theme }) {
  const nd = nextDate(contact.lastContacted, contact.freq);
  const diff = nd ? daysUntil(nd) : null;
  const badge =
    diff !== null
      ? diff < 0
        ? Math.abs(diff) + 'd overdue'
        : diff === 0
          ? 'Today'
          : diff + 'd'
      : '';
  const bc = diff !== null ? (diff < 0 ? theme.red : diff <= 7 ? theme.warn : theme.ac) : theme.t5;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 13,
        backgroundColor: theme.bg2,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.brd,
      }}
    >
      <View>
        <Avatar contact={contact} size={44} />
        <StrengthDot contact={contact} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 14, color: theme.t1, fontWeight: '500' }} numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.priority && (
            <View
              style={{
                backgroundColor: theme.warn + '18',
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 8, color: theme.warn, fontWeight: '700' }}>VIP</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
          {contact.role}
          {contact.role && contact.company ? ' / ' : ''}
          {contact.company}
        </Text>
        {contact.tags?.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {contact.tags.slice(0, 2).map((t) => (
              <TagPill key={t} tag={t} small />
            ))}
          </View>
        )}
        {(contact.notes || contact.topics) && (
          <Text
            style={{ fontSize: 11, color: theme.t6, marginTop: 3 }}
            numberOfLines={1}
          >
            {(contact.notes || contact.topics || '').slice(0, 60)}
          </Text>
        )}
      </View>
      {badge ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: bc }}>{badge}</Text>
          {nd ? (
            <Text style={{ fontSize: 10, color: theme.t6, marginTop: 2 }}>{fmtShort(nd)}</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function NotificationInbox({ contacts, onPickContact, onClose, onLogToday }) {
  const { theme } = useTheme();
  const overdueList = contacts
    .filter((c) => {
      const nd = nextDate(c.lastContacted, c.freq);
      return nd && daysUntil(nd) < 0;
    })
    .sort((a, b) => {
      const aN = nextDate(a.lastContacted, a.freq);
      const bN = nextDate(b.lastContacted, b.freq);
      return (aN || '').localeCompare(bN || '');
    });
  const todayList = contacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq);
    return nd && daysUntil(nd) === 0;
  });
  const weekList = contacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq);
    const d = nd ? daysUntil(nd) : null;
    return d !== null && d > 0 && d <= 7;
  });
  const recentNotes = [];
  contacts.forEach((c) =>
    (c.convLog || []).forEach((e) => {
      if (daysSince(e.date) !== null && daysSince(e.date) <= 7) recentNotes.push({ contact: c, note: e });
    }),
  );
  recentNotes.sort((a, b) => b.note.date.localeCompare(a.note.date));

  const isEmpty =
    !overdueList.length && !todayList.length && !weekList.length && !recentNotes.length;

  return (
    <View
      style={{
        backgroundColor: theme.bg3,
        borderBottomWidth: 1,
        borderBottomColor: theme.brd,
        padding: 16,
        maxHeight: 380,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.t1 }}>Notifications</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: theme.t5, fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      </View>
      <ScrollView>
        {overdueList.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.red,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Overdue ({overdueList.length})
            </Text>
            {overdueList.slice(0, 5).map((c) => {
              const nd = nextDate(c.lastContacted, c.freq);
              const d = Math.abs(daysUntil(nd));
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onPickContact(c)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.brd,
                  }}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.red }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500' }}>
                      {c.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.red }}>{d}d overdue</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onLogToday(c);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.brdAc,
                      backgroundColor: theme.bgAc,
                    }}
                  >
                    <Text style={{ color: theme.ac, fontSize: 10, fontWeight: '600' }}>Log</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {todayList.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.warn,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Due Today ({todayList.length})
            </Text>
            {todayList.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => onPickContact(c)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.brd,
                }}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.warn }}
                />
                <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500', flex: 1 }}>
                  {c.name}
                </Text>
                <Text style={{ fontSize: 11, color: theme.warn }}>Today</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {weekList.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.ac,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              This Week ({weekList.length})
            </Text>
            {weekList.map((c) => {
              const nd = nextDate(c.lastContacted, c.freq);
              const d = daysUntil(nd);
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onPickContact(c)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.brd,
                  }}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.ac }}
                  />
                  <Text style={{ fontSize: 13, color: theme.t1, fontWeight: '500', flex: 1 }}>
                    {c.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.ac }}>
                    {d === 1 ? 'Tomorrow' : 'In ' + d + 'd'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {recentNotes.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.t4,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Recent Activity
            </Text>
            {recentNotes.slice(0, 5).map((r, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onPickContact(r.contact)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.brd,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.info,
                    marginTop: 4,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: theme.t1, fontWeight: '500' }}>
                    {r.contact.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
                    {r.note.text}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.t6, marginTop: 2 }}>
                    {fmtDate(r.note.date)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isEmpty && (
          <Text style={{ textAlign: 'center', color: theme.t6, fontSize: 13, paddingVertical: 20 }}>
            All caught up. No notifications.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}