import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { Avatar, TagPill } from '../components/Common';
import { CalendarIcon, ChevronLeft, ChevronRight } from '../components/Icons';
import { nextDate, daysUntil, fmtShort, addDays, isoToday, fmtDate } from '../utils/helpers';

export default function NextUpScreen({
  activeContacts,
  allTags,
  onPickContact,
  onLogTouch,
  onSnooze,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState('list');
  const [tagFilter, setTagFilter] = useState('');

  const upcoming = useMemo(() => {
    return activeContacts
      .filter((c) => {
        const nd = nextDate(c.lastContacted, c.freq);
        if (!nd) return false;
        if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
        return true;
      })
      .map((c) => ({ contact: c, date: nextDate(c.lastContacted, c.freq) }))
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
            marginBottom: 12,
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
            <Text style={{ fontSize: 11, color: theme.t5, marginTop: 2 }}>
              {upcoming.length} upcoming touchpoint{upcoming.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {/* View toggle */}
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

        {/* Tag filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={() => setTagFilter('')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 20,
                borderWidth: 1,
                backgroundColor: !tagFilter ? theme.ac + '22' : 'transparent',
                borderColor: !tagFilter ? theme.ac : theme.brd2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: !tagFilter ? theme.ac : theme.t5,
                  fontWeight: '600',
                }}
              >
                All
              </Text>
            </TouchableOpacity>
            {(allTags || []).map((t) => {
              const on = tagFilter === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTagFilter(t)}
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
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {view === 'list' ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          {!upcoming.length && (
            <View style={{ alignItems: 'center', paddingVertical: 50 }}>
              <CalendarIcon size={56} color={theme.t6} strokeWidth={1.2} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.t2, marginTop: 16 }}>
                Nothing scheduled
              </Text>
              <Text style={{ fontSize: 13, color: theme.t6, marginTop: 6, textAlign: 'center' }}>
                Set follow-up frequencies on your contacts to see them here.
              </Text>
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
  const [showSnooze, setShowSnooze] = React.useState(false);
  const d = daysUntil(item.date);
  const isOverdue = d < 0;
  const isToday = d === 0;
  const badge = isOverdue
    ? Math.abs(d) + 'd overdue'
    : isToday
      ? 'Today'
      : d === 1
        ? 'Tomorrow'
        : 'In ' + d + 'd';
  const bc = isOverdue ? theme.red : isToday ? theme.warn : d <= 7 ? theme.ac : theme.t5;

  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Avatar contact={item.contact} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: theme.t1, fontWeight: '600' }} numberOfLines={1}>
            {item.contact.name}
          </Text>
          <Text style={{ fontSize: 11, color: theme.t5 }} numberOfLines={1}>
            {item.contact.role}
            {item.contact.role && item.contact.company ? ' / ' : ''}
            {item.contact.company}
          </Text>
          {item.contact.tags?.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              {item.contact.tags.slice(0, 2).map((t) => (
                <TagPill key={t} tag={t} small />
              ))}
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: bc }}>{badge}</Text>
          <Text style={{ fontSize: 10, color: theme.t6, marginTop: 2 }}>{fmtShort(item.date)}</Text>
        </View>
      </TouchableOpacity>
      {/* Actions */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: theme.brd,
        }}
      >
        <TouchableOpacity
          onPress={onLog}
          style={{
            flex: 1,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: theme.bgAc,
            borderWidth: 1,
            borderColor: theme.brdAc,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.ac, fontSize: 11, fontWeight: '600' }}>Log</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowSnooze(!showSnooze)}
          style={{
            flex: 1,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: theme.bg3,
            borderWidth: 1,
            borderColor: theme.brd2,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.t4, fontSize: 11, fontWeight: '600' }}>
            {showSnooze ? 'Cancel' : 'Snooze'}
          </Text>
        </TouchableOpacity>
      </View>
      {showSnooze && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
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
              }}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 8,
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
  );
}

function CalendarView({ upcoming, onPickContact }) {
  const { theme } = useTheme();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

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
                <View
                  style={{
                    flex: 1,
                    backgroundColor: isToday ? theme.bgAc : theme.bg2,
                    borderRadius: 8,
                    borderWidth: isToday ? 1 : 0,
                    borderColor: isToday ? theme.ac : 'transparent',
                    padding: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      color: isToday ? theme.ac : theme.t4,
                      fontWeight: isToday ? '700' : '500',
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
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Events for selected month */}
      <View style={{ marginTop: 20 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.ac,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Events This Month
        </Text>
        {upcoming
          .filter((x) => {
            const d = new Date(x.date + 'T12:00:00');
            return d.getMonth() === month.m && d.getFullYear() === month.y;
          })
          .map((x) => (
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
          ))}
      </View>
    </ScrollView>
  );
}
