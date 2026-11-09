import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import type { FoodSource } from '@/api/tracking';
import { formatKcal, formatTime, macroLine, sourceLabel } from '@/lib/dashboardView';
import { numeric, sizing, space, type, useTheme } from '@/theme';

import { TrustBadge } from './TrustBadge';

type Props = {
  name: string;
  source: FoodSource;
  loggedAt: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealLabel: string | null;
};

/** Read-only row. MealEntryRow adds the actions; tap to detail comes later. */
export function MealRow({ name, source, loggedAt, calories, protein, carbs, fat, mealLabel }: Props) {
  const { colors } = useTheme();
  const time = formatTime(loggedAt);
  const parts = [name, mealLabel, `${formatKcal(calories)} calories`, sourceLabel(source), time];
  const label = parts.filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={styles.left}>
        <Text
          style={[type.headline, { color: colors.text }]}
          numberOfLines={PixelRatio.getFontScale() >= 1.5 ? 2 : 1}
          maxFontSizeMultiplier={2}
        >
          {name}
        </Text>
        <Text style={[type.callout, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {macroLine(protein, carbs, fat)}
        </Text>
        <View style={styles.meta}>
          <TrustBadge source={source} />
          <Text style={[type.caption, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {time}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[type.headline, numeric, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {formatKcal(calories)}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          kcal
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizing.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  left: { flex: 1, gap: space.xs },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  right: { alignItems: 'flex-end' },
});
