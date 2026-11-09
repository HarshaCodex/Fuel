import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Food } from '@/api/food';
import { formatGrams, formatKcal, sourceLabel } from '@/lib/dashboardView';
import { numeric, sizing, space, type, useTheme } from '@/theme';

import { TrustBadge } from './TrustBadge';

type Props = { food: Food; onPress: () => void; /** Hairline under the row, inset like the meal rows; omit on the last row. */ divider?: boolean; /** Trailing chevron; rows that carry their own menu button turn it off. */ chevron?: boolean };

/** Tappable search or recent result: name, brand and serving, trust badge, kcal. */
export function FoodRow({ food, onPress, divider = false, chevron = true }: Props) {
  const { colors } = useTheme();
  const serving = `${formatGrams(food.servingSize)} ${food.servingUnit}`;
  const detail = [food.brand, serving].filter(Boolean).join(', ');
  const label = [food.name, food.brand, serving, `${formatKcal(food.calories)} calories`, sourceLabel(food.source)]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={divider ? [styles.divider, { borderColor: colors.border }] : undefined}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}
    >
      <View style={styles.left}>
        <Text style={[type.headline, { color: colors.text }]} numberOfLines={2} maxFontSizeMultiplier={2}>
          {food.name}
        </Text>
        <Text style={[type.callout, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {detail}
        </Text>
        <View style={styles.meta}>
          <TrustBadge source={food.source} />
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[type.headline, numeric, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {formatKcal(food.calories)}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          kcal
        </Text>
      </View>
      {chevron ? <Ionicons name="chevron-forward" size={sizing.icon} color={colors.textTertiary} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </Pressable>
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
  divider: { borderBottomWidth: sizing.border, marginHorizontal: 0 },
  left: { flex: 1, gap: space.xs },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  right: { alignItems: 'flex-end' },
});
