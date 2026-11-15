import { StyleSheet, Text, View } from 'react-native';

import type { MealLabel } from '@/api/tracking';
import { hapticSelect } from '@/lib/haptics';
import { radius, sizing, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props = { selected: MealLabel; onSelect: (meal: MealLabel) => void };

/** Own order (Snack before Dinner); MEAL_OPTIONS stays as is for the edit sheet. */
const MEALS: readonly { value: MealLabel; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
];

/** "MEAL" eyebrow and four pills; the chosen one is accent filled. */
export function MealPills({ selected, onSelect }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[type.eyebrow, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        Meal
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Meal" style={styles.row}>
        {MEALS.map((m) => {
          const on = m.value === selected;
          return (
            <PressableScale
              key={m.value}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                hapticSelect();
                onSelect(m.value);
              }}
              contentStyle={[styles.pill, { backgroundColor: on ? colors.accent : colors.surface }]}
            >
              <Text
                style={[type.action, { color: on ? colors.onAccent : colors.text }]}
                maxFontSizeMultiplier={2}
                numberOfLines={1}
              >
                {m.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    minHeight: sizing.touchMin,
    minWidth: sizing.touchMin,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
