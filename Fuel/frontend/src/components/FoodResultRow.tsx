import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Food } from '@/api/food';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { numeric, radius, sizing, space, type, useTheme } from '@/theme';

type Props = { food: Food; onPress: () => void; /** Hairline under the row; omit on the last row. */ divider?: boolean };

const macro = (n: number) => formatGrams(n);

/** Quick Log result or recent row: name, trust mark, source chip, serving macros, kcal. */
export function FoodResultRow({ food, onPress, divider = false }: Props) {
  const { colors } = useTheme();
  const serving = `${formatGrams(food.servingSize)} ${food.servingUnit}`;
  const label = [food.name, food.brand, serving, `${formatKcal(food.calories)} kcal`].filter(Boolean).join(', ');
  const yours = food.source === 'USER';
  return (
    <View style={divider ? [styles.divider, { borderColor: colors.divider }] : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}
      >
        <View style={styles.left}>
          <View style={styles.title}>
            <Text style={[type.label, styles.name, { color: colors.text }]} numberOfLines={2} maxFontSizeMultiplier={2}>
              {food.name}
            </Text>
            {food.source === 'USDA' ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.verified} accessibilityElementsHidden importantForAccessibility="no" />
            ) : null}
            <View style={[styles.chip, { backgroundColor: yours ? colors.accentSoft : colors.surfaceMuted }]}>
              <Text style={[type.caption, { color: yours ? colors.accentText : colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {yours ? 'Yours' : 'Packaged'}
              </Text>
            </View>
          </View>
          <Text style={[type.caption, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {`${serving} · P ${macro(food.protein)} · C ${macro(food.carbs)} · F ${macro(food.fat)}`}
          </Text>
        </View>
        <Text style={[type.value, numeric, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {formatKcal(food.calories)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: sizing.row, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  left: { flex: 1, gap: space.xs },
  title: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  name: { flexShrink: 1 },
  chip: { paddingHorizontal: space.sm, borderRadius: radius.sm, minHeight: 20, justifyContent: 'center' },
});
