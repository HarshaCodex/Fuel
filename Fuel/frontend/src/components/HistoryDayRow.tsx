import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HistoryDay } from '@/api/tracking';
import { formatKcal, macroLine } from '@/lib/dashboardView';
import { dayLabel, entriesLabel } from '@/lib/historyView';
import { numeric, radius, sizing, space, type, useTheme } from '@/theme';

type Props = { day: HistoryDay; onPress: (date: string) => void };

/** One logged day: calories against goal, macros, entry count. Tapping opens the day. */
export function HistoryDayRow({ day, onPress }: Props) {
  const { colors } = useTheme();
  const over = day.calorieGoal > 0 && day.calories > day.calorieGoal;
  const fraction = day.calorieGoal > 0 ? Math.min(Math.max(day.calories / day.calorieGoal, 0), 1) : 0;
  const label = dayLabel(day.date);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      accessibilityHint={`${formatKcal(day.calories)} calories, ${entriesLabel(day.entryCount)}`}
      onPress={() => onPress(day.date)}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.head}>
        <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
          {label}
        </Text>
        <Text style={[type.headline, numeric, { color: over ? colors.caution : colors.text }]} maxFontSizeMultiplier={1.5}>
          {formatKcal(day.calories)} kcal
        </Text>
      </View>
      <View testID="day-track" style={[styles.track, { backgroundColor: colors.barTrack }]}>
        <View
          testID="day-fill"
          style={[
            styles.fill,
            { width: `${fraction * 100}%`, backgroundColor: over ? colors.caution : colors.accent },
          ]}
        />
      </View>
      <View style={styles.head}>
        <Text style={[type.caption, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          {macroLine(day.protein, day.carbs, day.fat)}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          {entriesLabel(day.entryCount)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: sizing.touchMin,
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
