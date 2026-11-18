import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GoalsInput } from '@/api/user';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { PANEL_EMPTY, panelA11y } from '@/lib/setupView';
import { useCountUp } from '@/lib/useCountUp';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, numeric, radius, shadow, space, type, useTheme } from '@/theme';

import { Button } from './Button';

type Props = { goals?: GoalsInput; calculating?: boolean; onStart: () => void; startDisabled?: boolean };

const DOT = 8;

/** The bottom panel of Setup: the daily goal summary and the Start button. */
export function SetupPanel({ goals, calculating, onStart, startDisabled }: Props) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const kcal = useCountUp(goals?.calorieGoal ?? 0, reduce, goals?.calorieGoal ?? 0, motion.fast);
  const wrap = PixelRatio.getFontScale() >= 1.5;
  const edge = scheme === 'dark' ? { borderTopWidth: 1, borderColor: colors.border } : shadow.sheet;
  const entries = goals
    ? [
        { key: 'P', grams: goals.proteinGoal, color: colors.protein },
        { key: 'C', grams: goals.carbGoal, color: colors.carbs },
        { key: 'F', grams: goals.fatGoal, color: colors.fat },
      ]
    : [];
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }, edge]}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={goals ? panelA11y(goals) : PANEL_EMPTY}
        style={[styles.summary, calculating && styles.dim]}
      >
        {goals ? (
          <>
            <Text style={[type.label, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
              Your daily goal
            </Text>
            <View style={[styles.figures, wrap && styles.wrap]}>
              <View style={styles.kcalRow}>
                <Text style={[styles.kcal, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5} numberOfLines={1}>
                  {formatKcal(kcal)}
                </Text>
                <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                  kcal
                </Text>
              </View>
              <View style={styles.macros}>
                {entries.map((e) => (
                  <View key={e.key} style={styles.macro}>
                    <View style={[styles.dot, { backgroundColor: e.color }]} />
                    <Text style={[type.caption, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                      {`${e.key} ${formatGrams(e.grams)} g`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {PANEL_EMPTY}
          </Text>
        )}
      </View>
      <Button pill label="Start tracking" onPress={onStart} disabled={!goals || calculating || startDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.lg, gap: space.lg },
  summary: { gap: space.xs },
  dim: { opacity: 0.5 },
  figures: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  wrap: { flexDirection: 'column', alignItems: 'flex-start' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  kcal: { fontSize: 32, lineHeight: 38, fontFamily: 'Manrope_700Bold' },
  macros: { gap: space.xs },
  macro: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
