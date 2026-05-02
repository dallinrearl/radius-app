import React, { useMemo } from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polyline, G, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../styles/theme';
import { nextDate, daysUntil, daysSince, getTagColor } from '../utils/helpers';

const { width: SCREEN_W } = Dimensions.get('window');

export default function StatsScreen({ activeContacts }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Build 12-month series of contacts logged
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

  // Activity streaks
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

  // Health distribution
  const health = useMemo(() => {
    const r = { strong: 0, warm: 0, cool: 0, cold: 0 };
    activeContacts.forEach((c) => {
      const nd = nextDate(c.lastContacted, c.freq);
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
    return r;
  }, [activeContacts]);

  // 8-week activity
  const weeks = useMemo(() => {
    const r = [];
    for (let i = 7; i >= 0; i--) {
      const wEnd = new Date();
      wEnd.setDate(wEnd.getDate() - i * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);
      let count = 0;
      activeContacts.forEach((c) =>
        (c.convLog || []).forEach((e) => {
          if (!e.date) return;
          const ed = new Date(e.date + 'T12:00:00');
          if (ed >= wStart && ed <= wEnd) count++;
        }),
      );
      r.push({
        label: wStart.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count,
      });
    }
    return r;
  }, [activeContacts]);

  // Network by tag
  const tagCounts = useMemo(() => {
    const map = {};
    activeContacts.forEach((c) =>
      (c.tags || []).forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      }),
    );
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [activeContacts]);

  // Heatmap last 14 days
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

  const totalLogs = activeContacts.reduce((sum, c) => sum + (c.convLog || []).length, 0);
  const overdue = activeContacts.filter((c) => {
    const nd = nextDate(c.lastContacted, c.freq);
    return nd && daysUntil(nd) < 0;
  }).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 120,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            color: theme.t1,
            fontWeight: '600',
            marginBottom: 4,
            fontFamily: theme.fontDisplay,
          }}
        >
          Your Radius
        </Text>
        <Text style={{ fontSize: 12, color: theme.t5, marginBottom: 20 }}>
          Insights into your relationship building
        </Text>

        {/* Top stats grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 18 }}>
          <StatCard label="Total Contacts" value={activeContacts.length} color={theme.ac} />
          <StatCard label="Touchpoints Logged" value={totalLogs} color={theme.info} />
          <StatCard label="Overdue" value={overdue} color={theme.red} />
          <StatCard
            label="Active Tags"
            value={Object.keys(tagCounts).length || tagCounts.length}
            color={theme.purp}
          />
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

        {/* Health donut */}
        <Card title="Relationship Health">
          <DonutChart data={health} theme={theme} />
          <View style={{ marginTop: 12, gap: 6 }}>
            <LegendRow label="Strong" count={health.strong} color={theme.ac} />
            <LegendRow label="Warm" count={health.warm} color={theme.info} />
            <LegendRow label="Cool" count={health.cool} color={theme.warn} />
            <LegendRow label="Cold" count={health.cold} color={theme.red} />
          </View>
        </Card>

        {/* 8-week bars */}
        <Card title="Weekly Activity (8 Weeks)">
          <BarChart data={weeks} theme={theme} />
        </Card>

        {/* Tag breakdown */}
        <Card title="Network by Category">
          {tagCounts.length === 0 ? (
            <Text style={{ color: theme.t6, fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>
              No tagged contacts yet.
            </Text>
          ) : (
            tagCounts.map(([tag, count]) => {
              const max = tagCounts[0][1];
              const pct = (count / max) * 100;
              const c = getTagColor(tag);
              return (
                <View key={tag} style={{ marginBottom: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '500' }}>{tag}</Text>
                    <Text style={{ fontSize: 11, color: theme.t5, fontWeight: '600' }}>{count}</Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: theme.bg3,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: pct + '%',
                        height: '100%',
                        backgroundColor: c,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
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
      <Text style={{ fontSize: 12, color: theme.t3, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: theme.t2, fontWeight: '600' }}>{count}</Text>
    </View>
  );
}

function LineChart({ data, theme }) {
  const W = SCREEN_W - 80;
  const H = 140;
  const max = Math.max(...data.map((d) => d.count), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * (H - 20) - 10;
    return { x, y, count: d.count, label: d.label };
  });
  const path = points
    .map((p, i) => (i === 0 ? 'M' + p.x + ',' + p.y : 'L' + p.x + ',' + p.y))
    .join(' ');
  return (
    <View>
      <Svg width={W} height={H + 24}>
        {/* Grid */}
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
    </View>
  );
}

function BarChart({ data, theme }) {
  const W = SCREEN_W - 80;
  const H = 120;
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = (W / data.length) * 0.7;
  const gap = (W / data.length) * 0.3;
  return (
    <Svg width={W} height={H + 24}>
      {data.map((d, i) => {
        const bh = (d.count / max) * (H - 14);
        const x = i * (bw + gap) + gap / 2;
        const y = H - bh;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={bw} height={bh} fill={theme.ac} rx="3" />
            {d.count > 0 && (
              <SvgText x={x + bw / 2} y={y - 3} fontSize="9" fill={theme.t3} textAnchor="middle">
                {d.count}
              </SvgText>
            )}
            <SvgText x={x + bw / 2} y={H + 14} fontSize="8" fill={theme.t5} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function DonutChart({ data, theme }) {
  const total = data.strong + data.warm + data.cool + data.cold;
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
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const segments = [
    { v: data.strong, c: theme.ac },
    { v: data.warm, c: theme.info },
    { v: data.cool, c: theme.warn },
    { v: data.cold, c: theme.red },
  ].filter((s) => s.v > 0);
  let cumAngle = -Math.PI / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {segments.map((s, i) => {
          const a = (s.v / total) * Math.PI * 2;
          const x1 = cx + r * Math.cos(cumAngle);
          const y1 = cy + r * Math.sin(cumAngle);
          const x2 = cx + r * Math.cos(cumAngle + a);
          const y2 = cy + r * Math.sin(cumAngle + a);
          const large = a > Math.PI ? 1 : 0;
          const path = [
            'M ' + cx + ' ' + cy,
            'L ' + x1 + ' ' + y1,
            'A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2,
            'Z',
          ].join(' ');
          cumAngle += a;
          return <Path key={i} d={path} fill={s.c} />;
        })}
        <Circle cx={cx} cy={cy} r={r * 0.6} fill={theme.bg2} />
        <SvgText
          x={cx}
          y={cy - 4}
          fontSize="22"
          fill={theme.t1}
          fontWeight="700"
          textAnchor="middle"
        >
          {total}
        </SvgText>
        <SvgText x={cx} y={cy + 12} fontSize="10" fill={theme.t5} textAnchor="middle">
          Contacts
        </SvgText>
      </Svg>
    </View>
  );
}
