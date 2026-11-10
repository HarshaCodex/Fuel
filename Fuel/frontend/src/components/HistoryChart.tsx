import { StyleSheet, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import { dayLabel, type ChartBar } from '@/lib/historyView';
import { radius, sizing, space, useTheme } from '@/theme';

type Props = { bars: ChartBar[]; goal: number };

const HEIGHT = 120;
const DENSE_GAP = 2;
const DIM_OPACITY = 0.55;

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
  return (
    <View testID="history-chart" style={styles.root}>
      <View style={[styles.plot, { gap }]}>
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
                  opacity: b.isToday ? 1 : DIM_OPACITY,
                },
              ]}
            />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: space.sm },
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
