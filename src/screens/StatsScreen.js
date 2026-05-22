import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Line, G, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { nextDate, daysUntil } from '../utils/helpers';
import { TAG_COLORS, CUSTOM_TAG_COLORS } from '../constants';

// Distinct colors used for category slices that don't have a TAG_COLORS
// entry (companies, cities, tenure buckets). Health filter has its own
// semantic color set (strong/warm/cool/cold).
const PIE_PALETTE = [
  '#0077B6', '#00C9A7', '#7B5EEA', '#F4A261', '#E060A0',
  '#48B8E0', '#6B7FBA', '#F0B040', '#5BC2A8', '#A45EE0',
  '#3D8FD8', '#22B098',
];

// =================== Filter definitions ===================
//
// Each filter knows how to bucket the contacts list into a flat
// [{ label, count, color }] array. The pie chart consumes that directly.

const FILTERS = [
  { v: 'health', l: 'Health' },
  { v: 'category', l: 'Category' },
  { v: 'company', l: 'Company' },
  { v: 'location', l: 'Location' },
  { v: 'tenure', l: 'Tenure' },
  { v: 'next', l: 'Next Contact' },
];

function bucketByHealth(contacts, theme) {
  const r = { strong: 0, warm: 0, cool: 0, cold: 0 };
  contacts.forEach((c) => {
    const nd = nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek);
    if (!nd) {
      r.cool++;
      return;
    }
    const d = daysUntil(nd);
    if (d >= 0 && d <= 7) r.strong++;
    else if (d > 7) r.warm++;
    else if (d >= -14) r.cool++;
    else r.cold++;
  });
  return [
    { label: 'Strong', count: r.strong, color: theme.ac },
    { label: 'Warm', count: r.warm, color: theme.info },
    { label: 'Cool', count: r.cool, color: theme.warn },
    { label: 'Cold', count: r.cold, color: theme.red },
  ].filter((s) => s.count > 0);
}

function bucketByCategory(contacts) {
  const map = {};
  contacts.forEach((c) =>
    (c.tags || []).forEach((t) => {
      map[t] = (map[t] || 0) + 1;
    }),
  );
  // Untagged contacts get their own slice so the user can see how
  // disorganized the network is.
  const untagged = contacts.filter((c) => !c.tags || c.tags.length === 0).length;
  if (untagged > 0) map['Untagged'] = untagged;

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return sorted.map(([label, count], i) => ({
    label,
    count,
    color: TAG_COLORS[label] || CUSTOM_TAG_COLORS[i % CUSTOM_TAG_COLORS.length] || PIE_PALETTE[i % PIE_PALETTE.length],
  }));
}

function bucketByCompany(contacts) {
  const map = {};
  contacts.forEach((c) => {
    const key = (c.company || '').trim() || '(No company)';
    map[key] = (map[key] || 0) + 1;
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  // Long tail of one-offs gets folded into "Other" so the pie stays readable.
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8).reduce((sum, [, c]) => sum + c, 0);
  const arr = top.map(([label, count], i) => ({
    label,
    count,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  }));
  if (rest > 0) arr.push({ label: 'Other', count: rest, color: '#888888' });
  return arr;
}

function bucketByLocation(contacts) {
  const map = {};
  contacts.forEach((c) => {
    // Use location first; fall back to hometown if location is empty.
    const raw = (c.location || c.hometown || '').trim();
    const key = raw || '(Unknown)';
    map[key] = (map[key] || 0) + 1;
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8).reduce((sum, [, c]) => sum + c, 0);
  const arr = top.map(([label, count], i) => ({
    label,
    count,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
  }));
  if (rest > 0) arr.push({ label: 'Other', count: rest, color: '#888888' });
  return arr;
}

function bucketByTenure(contacts, theme) {
  // Tenure = how long the contact has been in the user's network. Anchor
  // off the earliest convLog entry, falling back to lastContacted, falling
  // back to "(Unknown)". Buckets:
  //   < 3 mo, 3-12 mo, 1-3 yr, 3+ yr, unknown
  const now = new Date();
  const buckets = {
    'New (< 3mo)': 0,
    '3-12 months': 0,
    '1-3 years': 0,
    '3+ years': 0,
    Unknown: 0,
  };

  contacts.forEach((c) => {
    let earliest = null;
    if (Array.isArray(c.convLog) && c.convLog.length > 0) {
      c.convLog.forEach((e) => {
        if (!e?.date) return;
        const t = Date.parse(e.date);
        if (Number.isFinite(t) && (earliest == null || t < earliest)) earliest = t;
      });
    }
    if (earliest == null && c.lastContacted) {
      const t = Date.parse(c.lastContacted);
      if (Number.isFinite(t)) earliest = t;
    }
    if (earliest == null) {
      buckets.Unknown++;
      return;
    }
    const days = (now.getTime() - earliest) / 86400000;
    if (days < 90) buckets['New (< 3mo)']++;
    else if (days < 365) buckets['3-12 months']++;
    else if (days < 365 * 3) buckets['1-3 years']++;
    else buckets['3+ years']++;
  });

  return [
    { label: 'New (< 3mo)', count: buckets['New (< 3mo)'], color: theme.ac },
    { label: '3-12 months', count: buckets['3-12 months'], color: theme.info },
    { label: '1-3 years', count: buckets['1-3 years'], color: theme.purp },
    { label: '3+ years', count: buckets['3+ years'], color: theme.warn },
    { label: 'Unknown', count: buckets.Unknown, color: '#888888' },
  ].filter((s) => s.count > 0);
}

// Bucket by time-to-next-contact based on each contact's lastContacted +
// freq schedule. "Overdue" gets a hot color, then cooling palette as the
// horizon stretches out. Contacts with no schedule (freq: 'never' or no
// lastContacted at all) get their own bucket so they're visible.
function bucketByNextContact(contacts, theme) {
  const buckets = {
    'Overdue': 0,
    'Within 1 week': 0,
    '1 week-1 month': 0,
    '1-3 months': 0,
    '3-6 months': 0,
    '6 months-1 year': 0,
    '1+ year': 0,
    'No schedule': 0,
  };

  contacts.forEach((c) => {
    const nd = nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek);
    if (!nd) {
      buckets['No schedule']++;
      return;
    }
    const d = daysUntil(nd);
    if (d < 0) buckets['Overdue']++;
    else if (d <= 7) buckets['Within 1 week']++;
    else if (d <= 30) buckets['1 week-1 month']++;
    else if (d <= 90) buckets['1-3 months']++;
    else if (d <= 180) buckets['3-6 months']++;
    else if (d <= 365) buckets['6 months-1 year']++;
    else buckets['1+ year']++;
  });

  return [
    { label: 'Overdue', count: buckets['Overdue'], color: theme.red },
    { label: 'Within 1 week', count: buckets['Within 1 week'], color: theme.warn },
    { label: '1 week-1 month', count: buckets['1 week-1 month'], color: theme.ac },
    { label: '1-3 months', count: buckets['1-3 months'], color: theme.info },
    { label: '3-6 months', count: buckets['3-6 months'], color: theme.purp },
    { label: '6 months-1 year', count: buckets['6 months-1 year'], color: '#5BC2A8' },
    { label: '1+ year', count: buckets['1+ year'], color: '#6B7FBA' },
    { label: 'No schedule', count: buckets['No schedule'], color: '#888888' },
  ].filter((s) => s.count > 0);
}

// =================== Main screen ===================

export default function StatsScreen({ activeContacts }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pieFilter, setPieFilter] = useState('health');

  // Build 12-month series of touchpoints logged.
  const monthly = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const monthStr =
        d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      let count = 0;
      activeContacts.forEach((c) => {
        (c.convLog || []).forEach((e) => {
          if (e.date && e.date.startsWith(monthStr)) count++;
        });
      });
      result.push({ label, count });
    }
    return result;
  }, [activeContacts]);

  // Activity streaks.
  const streaks = useMemo(() => {
    const allDates = new Set();
    activeContacts.forEach((c) =>
      (c.convLog || []).forEach((e) => {
        if (e.date) allDates.add(e.date);
      }),
    );
    const today = new Date().toISOString().slice(0, 10);
    let curr = 0;
    const cd = new Date(today + 'T12:00:00');
    while (allDates.has(cd.toISOString().slice(0, 10))) {
      curr++;
      cd.setDate(cd.getDate() - 1);
    }
    let best = 0;
    let temp = 0;
    const sorted = Array.from(allDates).sort();
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        temp = 1;
      } else {
        const prev = new Date(sorted[i - 1] + 'T12:00:00');
        const cur = new Date(sorted[i] + 'T12:00:00');
        const diff = Math.round((cur - prev) / 86400000);
        if (diff === 1) temp++;
        else temp = 1;
      }
      if (temp > best) best = temp;
    }
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - 1);
    let thisWeek = 0;
    let thisMonth = 0;
    activeContacts.forEach((c) =>
      (c.convLog || []).forEach((e) => {
        if (!e.date) return;
        const ed = new Date(e.date + 'T12:00:00');
        if (ed >= weekStart) thisWeek++;
        if (ed >= monthStart) thisMonth++;
      }),
    );
    return { current: curr, best, thisWeek, thisMonth };
  }, [activeContacts]);

  // Heatmap last 14 days.
  const heatmap = useMemo(() => {
    const r = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      let count = 0;
      activeContacts.forEach((c) =>
        (c.convLog || []).forEach((e) => {
          if (e.date === ds) count++;
        }),
      );
      r.push({ date: ds, count, day: d.getDate() });
    }
    return r;
  }, [activeContacts]);

  // Pie data for the currently selected filter.
  const pieData = useMemo(() => {
    switch (pieFilter) {
      case 'health':
        return bucketByHealth(activeContacts, theme);
      case 'category':
        return bucketByCategory(activeContacts);
      case 'company':
        return bucketByCompany(activeContacts);
      case 'location':
        return bucketByLocation(activeContacts);
      case 'tenure':
        return bucketByTenure(activeContacts, theme);
      case 'next':
        return bucketByNextContact(activeContacts, theme);
      default:
        return [];
    }
  }, [activeContacts, pieFilter, theme]);

  const totalLogs = activeContacts.reduce((sum, c) => sum + (c.convLog || []).length, 0);
  const overdue = activeContacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq, c.freqStartedAt, c.freqDayOfWeek);
    return nd && daysUntil(nd) < 0;
  }).length;
  const activeTagCount = useMemo(() => {
    const set = new Set();
    activeContacts.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return set.size;
  }, [activeContacts]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          paddingTop: insets.top + 20,
          paddingBottom: 20,
          paddingHorizontal: 20,
          backgroundColor: theme.navBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.brd,
        }}
      >
        <Text
          style={{
            fontSize: 26,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 4,
            fontFamily: theme.fontDisplay,
          }}
        >
          Your Activity
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5 }}>
          Insights into your relationship building
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 120,
        }}
      >

        {/* Top stats grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginHorizontal: -4,
            marginBottom: 18,
          }}
        >
          <StatCard label="Total Contacts" value={activeContacts.length} color={theme.ac} />
          <StatCard label="Touchpoints Logged" value={totalLogs} color={theme.info} />
          <StatCard label="Overdue" value={overdue} color={theme.red} />
          <StatCard label="Active Tags" value={activeTagCount} color={theme.purp} />
        </View>

        {/* Activity Line Chart */}
        <Card title="Activity (12 Months)">
          <LineChart data={monthly} theme={theme} />
        </Card>

        {/* Streaks */}
        <Card title="Activity Streaks">
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginHorizontal: -6,
              marginBottom: 14,
            }}
          >
            <MiniStat label="Current Streak" value={streaks.current + 'd'} color={theme.warn} />
            <MiniStat label="Best Streak" value={streaks.best + 'd'} color={theme.ac} />
            <MiniStat label="This Week" value={streaks.thisWeek} color={theme.info} />
            <MiniStat label="This Month" value={streaks.thisMonth} color={theme.purp} />
          </View>
          <Text
            style={{
              fontSize: 10,
              color: theme.t5,
              fontWeight: '700',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Last 14 Days
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {heatmap.map((c, i) => {
              const max = Math.max(...heatmap.map((x) => x.count), 1);
              const intensity = c.count / max;
              const bg =
                c.count === 0
                  ? theme.bg3
                  : intensity > 0.66
                    ? theme.ac
                    : intensity > 0.33
                      ? theme.ac + 'AA'
                      : theme.ac + '55';
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    backgroundColor: bg,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 8,
                      color: c.count > 0 ? '#fff' : theme.t6,
                      fontWeight: '600',
                    }}
                  >
                    {c.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Filtered Pie Chart */}
        <Card title="Network Breakdown">
          <FilterTabs filters={FILTERS} value={pieFilter} onChange={setPieFilter} theme={theme} />
          <View style={{ marginTop: 14 }}>
            <PieChart
              data={pieData}
              theme={theme}
              filterLabel={FILTERS.find((f) => f.v === pieFilter)?.l || ''}
            />
          </View>
          <View style={{ marginTop: 14, gap: 6 }}>
            {pieData.length === 0 ? (
              <Text
                style={{
                  color: theme.t6,
                  fontSize: 12,
                  textAlign: 'center',
                  paddingVertical: 14,
                }}
              >
                No data for this view yet.
              </Text>
            ) : (
              pieData.map((s) => (
                <LegendRow key={s.label} label={s.label} count={s.count} color={s.color} />
              ))
            )}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

// =================== Sub-components ===================

function FilterTabs({ filters, value, onChange, theme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
      }}
    >
      {filters.map((f) => {
        const on = value === f.v;
        return (
          <TouchableOpacity
            key={f.v}
            onPress={() => onChange(f.v)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: on ? theme.ac : theme.bg3,
              borderColor: on ? theme.ac : theme.brd2,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: on ? theme.bg : theme.t4,
              }}
            >
              {f.l}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Card({ title, children }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.bg2,
        borderWidth: 1,
        borderColor: theme.brd,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: theme.ac,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function StatCard({ label, value, color }) {
  const { theme } = useTheme();
  return (
    <View style={{ width: '50%', paddingHorizontal: 4, marginBottom: 8 }}>
      <View
        style={{
          backgroundColor: theme.bg2,
          borderWidth: 1,
          borderColor: theme.brd,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <Text style={{ fontSize: 22, color, fontWeight: '700', fontFamily: theme.fontBodyBold }}>
          {value}
        </Text>
        <Text
          style={{
            fontSize: 10,
            color: theme.t5,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginTop: 2,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value, color }) {
  const { theme } = useTheme();
  return (
    <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 6 }}>
      <View
        style={{
          backgroundColor: theme.bg3,
          borderRadius: 10,
          padding: 10,
        }}
      >
        <Text style={{ fontSize: 18, color, fontWeight: '700' }}>{value}</Text>
        <Text style={{ fontSize: 9, color: theme.t5, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}

function LegendRow({ label, count, color }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: theme.t3, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '600' }}>{count}</Text>
    </View>
  );
}

function LineChart({ data, theme }) {
  const [W, setW] = useState(0);
  const H = 140;
  // Inset so the leftmost/rightmost dots and labels don't sit on the edge.
  const PAD_X = 8;
  const max = Math.max(...data.map((d) => d.count), 1);
  const plotW = Math.max(W - PAD_X * 2, 0);
  const points = data.map((d, i) => {
    const x = PAD_X + (i / (data.length - 1)) * plotW;
    const y = H - (d.count / max) * (H - 20) - 10;
    return { x, y, count: d.count, label: d.label };
  });
  const path = points
    .map((p, i) => (i === 0 ? 'M' + p.x + ',' + p.y : 'L' + p.x + ',' + p.y))
    .join(' ');
  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {W > 0 && (
        <Svg width={W} height={H + 24}>
          {[0.25, 0.5, 0.75].map((p, i) => (
            <Line
              key={i}
              x1="0"
              y1={H * p}
              x2={W}
              y2={H * p}
              stroke={theme.brd}
              strokeWidth="0.5"
            />
          ))}
          <Path d={path} stroke={theme.ac} strokeWidth="2" fill="none" />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r="3" fill={theme.ac} />
          ))}
          {points.map((p, i) =>
            i % 2 === 0 ? (
              <SvgText
                key={'l' + i}
                x={p.x}
                y={H + 14}
                fontSize="9"
                fill={theme.t5}
                textAnchor="middle"
              >
                {p.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}

// Upgraded donut chart. Visual upgrades over a basic pie:
//   - Donut form with center label (total count + filter name)
//   - White separator strokes between slices for crisp definition
//   - Largest slice gets a subtle outer halo / lift to draw the eye
//   - Slight inner radial-gradient shading for soft depth (no hard shadows)
//   - Drop-in compatible with the previous PieChart props
function PieChart({ data, theme, filterLabel }) {
  const total = data.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return (
      <Text
        style={{
          color: theme.t6,
          fontSize: 12,
          textAlign: 'center',
          paddingVertical: 30,
        }}
      >
        No contacts yet.
      </Text>
    );
  }

  // Sizing — slightly larger so the donut feels like a hero element.
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 88;        // outer edge of donut ring
  const rOuterHalo = 92;    // halo edge for the dominant slice
  const rInner = 54;        // inner edge — bigger hole = more elegant
  const ringGap = 1.5;      // tiny visual gap between slices

  // Find largest slice to give it gentle emphasis.
  let largestIdx = 0;
  data.forEach((s, i) => {
    if (s.count > data[largestIdx].count) largestIdx = i;
  });

  // Build slice paths.
  let cumAngle = -Math.PI / 2;
  const slices = data.map((s, i) => {
    const a = (s.count / total) * Math.PI * 2;
    const isLargest = i === largestIdx && data.length > 1;
    const startA = cumAngle + (data.length > 1 ? ringGap / rOuter / 2 : 0);
    const endA = cumAngle + a - (data.length > 1 ? ringGap / rOuter / 2 : 0);

    // Use the slightly larger radius for the dominant slice's outer edge.
    const ro = isLargest ? rOuterHalo : rOuter;

    let path;
    if (data.length === 1) {
      // Single slice — render as a full annulus (donut ring) instead of
      // trying to draw an arc that wraps 360°, which is degenerate in SVG.
      path = (
        <G key={i}>
          <Circle cx={cx} cy={cy} r={ro} fill={s.color} />
          <Circle cx={cx} cy={cy} r={rInner} fill={theme.bg2} />
        </G>
      );
    } else {
      const x1 = cx + ro * Math.cos(startA);
      const y1 = cy + ro * Math.sin(startA);
      const x2 = cx + ro * Math.cos(endA);
      const y2 = cy + ro * Math.sin(endA);
      const xi1 = cx + rInner * Math.cos(endA);
      const yi1 = cy + rInner * Math.sin(endA);
      const xi2 = cx + rInner * Math.cos(startA);
      const yi2 = cy + rInner * Math.sin(startA);
      const large = a > Math.PI ? 1 : 0;
      const d = [
        'M ' + x1 + ' ' + y1,
        'A ' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2,
        'L ' + xi1 + ' ' + yi1,
        'A ' + rInner + ' ' + rInner + ' 0 ' + large + ' 0 ' + xi2 + ' ' + yi2,
        'Z',
      ].join(' ');
      path = (
        <Path
          key={i}
          d={d}
          fill={s.color}
          stroke={theme.bg2}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    }
    cumAngle += a;
    return path;
  });

  // Choose label text colors. Theme-friendly fallback chain.
  const totalColor = theme.t1 || '#222';
  const labelColor = theme.t5 || '#888';

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Soft radial inner shading to give the donut a hint of depth
              without going full skeuomorphic. */}
          <RadialGradient id="pieShade" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0" />
            <Stop offset="0.85" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.07" />
          </RadialGradient>
        </Defs>

        {/* Slices */}
        {slices}

        {/* Inner shadow ring for soft depth on the outer rim */}
        <Circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="url(#pieShade)"
          stroke="none"
          pointerEvents="none"
        />

        {/* Center label — total count + filter name */}
        <SvgText
          x={cx}
          y={cy - 2}
          fontSize="26"
          fontWeight="700"
          fill={totalColor}
          textAnchor="middle"
        >
          {total}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 16}
          fontSize="10"
          fontWeight="600"
          fill={labelColor}
          textAnchor="middle"
          letterSpacing={0.6}
        >
          {(filterLabel || 'Total').toUpperCase()}
        </SvgText>
      </Svg>
    </View>
  );
}