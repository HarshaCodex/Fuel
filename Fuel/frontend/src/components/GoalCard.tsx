import { StyleSheet, Text, View } from 'react-native';

import type { Goals } from '@/api/user';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { hapticLight } from '@/lib/haptics';
import { goalA11y, GOAL_SOURCE_LABEL, goalSource, macroTiles } from '@/lib/profileView';
import { useCountUp } from '@/lib/useCountUp';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { numeric, radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { PressableScale } from './PressableScale';

type Props = {
  goals: Goals;
  /** Count the calories up from 0 (first load only). */
  countUp?: boolean;
  onEdit: () => void;
};

const CHIP = 28;

/** The daily goal: where it came from, the calories, three macro tiles and an Edit goals button. */
export function GoalCard({ goals, countUp = false, onEdit }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const reduce = useReduceMotion();
  const kcal = useCountUp(goals.calorieGoal, reduce, countUp ? 0 : goals.calorieGoal);
  const dots = { protein: colors.protein, carbs: colors.carbs, fat: colors.fat };
  return (
    <View style={[styles.card, card]}>
      <View accessible accessibilityLabel={goalA11y(goals)} style={styles.summary}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
              Daily goal
            </Text>
            <View style={styles.kcalRow}>
              <Text testID="goal-kcal" style={[styles.kcal, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                {formatKcal(kcal)}
              </Text>
              <Text style={[styles.unit, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                kcal
              </Text>
            </View>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.chipText, { color: colors.accentText }]} maxFontSizeMultiplier={1.3}>
              {GOAL_SOURCE_LABEL[goalSource(goals)]}
            </Text>
          </View>
        </View>
        <View style={styles.tiles}>
          {macroTiles(goals).map((t) => (
            <View key={t.key} style={[styles.tile, { backgroundColor: colors.tileFill }]}>
              <View style={styles.nameRow}>
                <View style={[styles.dot, { backgroundColor: dots[t.key] }]} />
                <Text style={[styles.tileLabel, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                  {t.label}
                </Text>
              </View>
              <Text style={[styles.grams, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                {`${formatGrams(t.grams)} g`}
              </Text>
              {t.share === null ? null : (
                <Text style={[type.tileCaption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                  {`${t.share}% of kcal`}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Edit goals"
        onPress={() => {
          hapticLight();
          onEdit();
        }}
        contentStyle={[styles.button, { backgroundColor: colors.accentSoft }]}
      >
        <Text style={[styles.buttonText, { color: colors.accentText }]} maxFontSizeMultiplier={1.5}>
          Edit goals
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, padding: 20, gap: space.lg },
  summary: { gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_600SemiBold' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs + 2 },
  kcal: { fontSize: 40, lineHeight: 48, fontFamily: 'Manrope_700Bold', letterSpacing: -0.8 },
  unit: { fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_500Medium' },
  chip: { minHeight: CHIP, paddingHorizontal: space.md, borderRadius: radius.full, justifyContent: 'center' },
  chipText: { fontSize: 12, lineHeight: 16, fontFamily: 'Manrope_700Bold' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: space.md, paddingHorizontal: space.md, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_600SemiBold' },
  grams: { fontSize: 20, lineHeight: 26, fontFamily: 'Manrope_700Bold' },
  button: { minHeight: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
});
