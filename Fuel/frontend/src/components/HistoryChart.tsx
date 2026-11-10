import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import { dayLabel, type ChartBar } from '@/lib/historyView';
import { numeric, radius, sizing, space, type, useTheme } from '@/theme';

type Props = { bars: ChartBar[]; goal: number };

const HEIGHT = 120;
const DENSE_GAP = 2;
const CAP = 2;

const shortDate = (iso: string): string => dayLabel(iso).split(' ').slice(1).join(' ');

const labelFor = (b: ChartBar, goal: number): string => {
  const goalText = goal > 0 ? `, goal ${formatKcal(goal)}` : '';
  const today = b.isToday ? ', today' : '';
  return b.weekly
    ? `Week of ${dayLabel(b.date)}, average ${formatKcal(b.calories)} calories${goalText}${today}`
    : `${dayLabel(b.date)}, ${formatKcal(b.calories)} calories${goalText}${today}`;
};

/** Calories per day as plain bars with a dashed goal line. Long ranges show weekly averages. */
export function HistoryChart({ bars, goal }: Props) {
  const { colors } = useTheme();
  const max = Math.max(goal, ...bars.map((b) => b.calories), 1);
  const gap = bars.length <= 7 ? space.sm : bars.length <= 30 ? DENSE_GAP : space.xs;
  const first = bars[0];
  const last = bars[bars.length - 1];
  return (
    <View testID="history-chart" style={styles.root}>
      {goal > 0 && (
        <Text style={[type.caption, numeric, styles.goalText, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          Goal {formatKcal(goal)}
        </Text>
      )}
      <View testID="history-plot" style={[styles.plot, { gap }]}>
        {bars.map((b) => (
          <View
            key={b.date}
            accessible
            accessibilityLabel={labelFor(b, goal)}
            style={styles.column}
          >
            <View
              testID={b.isToday ? 'bar-today' : 'bar'}
              style={[
                styles.bar,
                {
                  height: Math.max((b.calories / max) * HEIGHT, b.calories > 0 ? 2 : 0),
                  backgroundColor: colors.accent,
                },
              ]}
            >
              {b.isToday && <View testID="today-cap" style={[styles.cap, { backgroundColor: colors.text }]} />}
            </View>
          </View>
        ))}
        {goal > 0 && (
          <View
            testID="goal-line"
            pointerEvents="none"
            style={[styles.goal, { bottom: (goal / max) * HEIGHT, borderColor: colors.borderStrong }]}
          />
        )}
      </View>
      {first && last && (
        <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {shortDate(first.date)}
          </Text>
          <Text
            style={[type.caption, { color: last.isToday ? colors.text : colors.textSecondary, fontWeight: last.isToday ? '700' : '500' }]}
            maxFontSizeMultiplier={1.5}
          >
            {last.isToday ? 'Today' : shortDate(last.endDate)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: space.sm, gap: space.xs },
  goalText: { textAlign: 'right' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  cap: { position: 'absolute', top: 0, left: 0, right: 0, height: CAP },
  plot: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, height: HEIGHT, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2 },
  goal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: sizing.border,
    borderStyle: 'dashed',
  },
});
