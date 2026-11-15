import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Food } from '@/api/food';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { numeric, radius, sizing, space, type, useTheme } from '@/theme';

type Props = {
  food: Food;
  onPress: () => void;
  /** Hairline under the row; omit on the last row. */
  divider?: boolean;
  /** Shows the one-tap "+" button. Omit in search results. */
  onAdd?: () => void;
  /** The "+" shows a check (the food was just logged). */
  added?: boolean;
  /** A log request is in flight: the "+" is disabled. */
  adding?: boolean;
};

const macro = (n: number) => formatGrams(n);

/** Quick Log result or recent row: name, trust mark, source chip, serving macros, kcal. */
export function FoodResultRow({ food, onPress, divider = false, onAdd, added = false, adding = false }: Props) {
  const { colors } = useTheme();
  const serving = `${formatGrams(food.servingSize)} ${food.servingUnit}`;
  const label = [food.name, food.brand, serving, `${formatKcal(food.calories)} kcal`].filter(Boolean).join(', ');
  const yours = food.source === 'USER';
  return (
    <View style={[styles.wrap, divider && styles.divider, divider && { borderColor: colors.divider }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface }, onAdd && styles.rowWithAdd]}
      >
        <View style={styles.left}>
          <View style={styles.title}>
            <Text style={[type.label, styles.name, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={2}>
              {food.name}
            </Text>
            {food.source === 'USDA' ? (
              <Ionicons name="checkmark" size={14} color={colors.verified} accessibilityElementsHidden importantForAccessibility="no" />
            ) : null}
            {yours ? (
              <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Yours
                </Text>
              </View>
            ) : food.source !== 'USDA' ? (
              <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Packaged
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[type.caption, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {`${serving} · P ${macro(food.protein)} · C ${macro(food.carbs)} · F ${macro(food.fat)}`}
          </Text>
        </View>
        <Text style={[type.value, numeric, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {formatKcal(food.calories)}
        </Text>
      </Pressable>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={added ? `Added ${food.name}` : `Log ${food.name}, ${serving}`}
          accessibilityState={{ disabled: adding }}
          disabled={adding}
          onPress={onAdd}
          hitSlop={space.xs}
          style={[styles.add, { backgroundColor: added ? colors.accent : colors.accentSoft }]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name={added ? 'checkmark' : 'add'} size={sizing.icon} color={added ? colors.onAccent : colors.accent} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  rowWithAdd: { paddingRight: space.sm },
  add: { width: sizing.touchMin, height: sizing.touchMin, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  row: { flex: 1, minHeight: sizing.row, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  left: { flex: 1, gap: space.xs },
  title: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  name: { flexShrink: 1 },
  chip: { paddingHorizontal: space.sm, borderRadius: radius.sm, minHeight: 20, justifyContent: 'center' },
});
