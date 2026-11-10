import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import type { HistorySummaryModel } from '@/lib/historyView';
import { numeric, radius, space, type, useTheme } from '@/theme';

/** Average calories per logged day and how many logged days were on goal. */
export function HistorySummary({ averageCalories, daysLogged, daysOnGoal }: HistorySummaryModel) {
  const { colors } = useTheme();
  const items = [
    { value: formatKcal(averageCalories), caption: 'Avg kcal per logged day' },
    { value: `${daysOnGoal} of ${daysLogged}`, caption: 'Days on goal' },
  ];
  return (
    <View style={styles.row}>
      {items.map((i) => (
        <View
          key={i.caption}
          accessible
          accessibilityLabel={`${i.caption}, ${i.value}`}
          style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[type.title2, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
            {i.value}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {i.caption}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.xs, padding: space.lg, borderRadius: radius.md, borderWidth: 1 },
});
