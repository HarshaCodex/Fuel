import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import { numeric, radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { CalorieRing } from './CalorieRing';
import { NutrientTable } from './NutrientTable';

type Macro = { consumed: number; goal: number };
type Props = { calories: Macro; protein: Macro; carbs: Macro; fat: Macro };

/** The Today hero: calorie ring, eaten and goal, then the nutrient table, on one soft card. */
export function HeroCard({ calories, protein, carbs, fat }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  return (
    <View style={[styles.card, card]}>
      <CalorieRing consumed={calories.consumed} goal={calories.goal} hero />
      <View style={styles.totals} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[
          [formatKcal(calories.consumed), 'eaten'],
          [formatKcal(calories.goal), 'goal'],
        ].map(([n, l]) => (
          <Text key={l} style={[type.body, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            <Text style={[type.headline, { color: colors.text }]}>{n}</Text>
            {` ${l}`}
          </Text>
        ))}
      </View>
      <NutrientTable protein={protein} carbs={carbs} fat={fat} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.xl, borderRadius: radius.xl, gap: space.lg },
  totals: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
});
