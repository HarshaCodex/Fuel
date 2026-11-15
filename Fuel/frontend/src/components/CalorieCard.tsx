import { StyleSheet, Text, View } from 'react-native';

import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { calorieSplit, type Macros } from '@/lib/portion';
import { useCountUp } from '@/lib/useCountUp';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, numeric, radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { useKeyboardHeight } from './KeyboardAvoider';

type Props = { macros: Macros; amountLabel: string };

const BIG = 56;
const COMPACT = 40;
const BAR = 8;
const GAP = 2;
const DOT = 8;

/** Calories for the chosen portion, a calorie split bar and the three macros. One accessible element. */
export function CalorieCard({ macros, amountLabel }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const reduce = useReduceMotion();
  const compact = useKeyboardHeight() > 0;
  const split = calorieSplit(macros);
  const kcal = useCountUp(macros.calories, reduce, macros.calories, motion.fast);
  const flex = {
    protein: useCountUp(split.protein, reduce, split.protein, motion.fast),
    carbs: useCountUp(split.carbs, reduce, split.carbs, motion.fast),
    fat: useCountUp(split.fat, reduce, split.fat, motion.fast),
  };
  const cols = [
    { key: 'protein', name: 'Protein', color: colors.protein, grams: macros.protein },
    { key: 'carbs', name: 'Carbs', color: colors.carbs, grams: macros.carbs },
    { key: 'fat', name: 'Fat', color: colors.fat, grams: macros.fat },
  ] as const;
  const label = `${formatKcal(macros.calories)} calories, protein ${formatGrams(macros.protein)} grams, carbs ${formatGrams(macros.carbs)} grams, fat ${formatGrams(macros.fat)} grams`;
  return (
    <View accessible accessibilityLabel={label} style={[styles.card, card]}>
      <Text
        testID="calorie-card-kcal"
        style={[{ fontSize: compact ? COMPACT : BIG, lineHeight: compact ? COMPACT + 4 : BIG + 4, letterSpacing: -0.03 * (compact ? COMPACT : BIG), fontFamily: type.title1.fontFamily }, numeric, styles.center, { color: colors.text }]}
        maxFontSizeMultiplier={2}
      >
        {formatKcal(kcal)}
      </Text>
      <Text style={[styles.sub, styles.center, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {`kcal in ${amountLabel}`}
      </Text>
      <View testID="calorie-split" style={[styles.bar, { backgroundColor: colors.barTrack }]}>
        {cols.map((c) =>
          split[c.key] > 0 ? (
            <View key={c.key} testID={`split-${c.key}`} style={{ flex: Math.max(flex[c.key], 0.0001), backgroundColor: c.color }} />
          ) : null,
        )}
      </View>
      <View style={styles.cols}>
        {cols.map((c) => (
          <View key={c.key} style={styles.col}>
            <View style={styles.nameRow}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={[type.caption, { color: colors.textSecondary, fontFamily: type.label.fontFamily }]} maxFontSizeMultiplier={2}>
                {c.name}
              </Text>
            </View>
            <Text style={[styles.grams, numeric, { color: colors.text }]} maxFontSizeMultiplier={2}>
              {`${formatGrams(c.grams)} g`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, paddingTop: space.xl, paddingHorizontal: space.lg + space.xs, paddingBottom: space.lg + space.xs, gap: space.lg + 2 },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: type.label.fontFamily },
  grams: { fontSize: 20, lineHeight: 26, fontFamily: type.value.fontFamily },
  center: { textAlign: 'center' },
  bar: { flexDirection: 'row', height: BAR, borderRadius: BAR / 2, gap: GAP, overflow: 'hidden' },
  cols: { flexDirection: 'row', gap: space.sm },
  col: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
