import { useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GoalsInput } from '@/api/user';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { PANEL_EMPTY, panelA11y } from '@/lib/setupView';
import { useCountUp } from '@/lib/useCountUp';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, numeric, radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { Button } from './Button';

type Props = { goals?: GoalsInput; calculating?: boolean; onStart: () => void; startDisabled?: boolean };

const DOT = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const CALCULATING = 'Calculating your goal...';

/** The calorie number; mounted only with goals, so the first value shows without animation. */
function Kcal({ value, from }: { value: number; from: number }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const shown = useCountUp(value, reduce, from, motion.fast);
  return (
    <Text style={[styles.kcal, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5} numberOfLines={1}>
      {formatKcal(shown)}
    </Text>
  );
}

/** The bottom panel of Setup: the daily goal summary and the Start button. */
export function SetupPanel({ goals, calculating, onStart, startDisabled }: Props) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  // Remember the last shown goal so a new result counts from it, not from 0.
  const [shown, setShown] = useState<{ from?: number; cur?: number }>({});
  const goal = goals?.calorieGoal;
  if (goal !== undefined && goal !== shown.cur) setShown({ from: shown.cur, cur: goal });
  const from = shown.from ?? goal ?? 0;
  const wrap = PixelRatio.getFontScale() >= 1.5;
  const edge = scheme === 'dark' ? { borderTopWidth: 1, borderColor: colors.border } : shadow.panel;
  const entries = goals
    ? [
        { key: 'P', grams: goals.proteinGoal, color: colors.protein },
        { key: 'C', grams: goals.carbGoal, color: colors.carbs },
        { key: 'F', grams: goals.fatGoal, color: colors.fat },
      ]
    : [];
  const message = calculating ? CALCULATING : PANEL_EMPTY;
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, PAD_BOTTOM) },
        edge,
      ]}
    >
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={goals ? panelA11y(goals) : message}
        style={[styles.summary, calculating && !!goals && styles.dim]}
      >
        {goals ? (
          <>
            <Text style={[styles.heading, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
              Your daily goal
            </Text>
            <View style={[styles.figures, wrap && styles.wrap]}>
              <View style={styles.kcalRow}>
                <Kcal value={goals.calorieGoal} from={from} />
                <Text style={[type.label, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                  kcal
                </Text>
              </View>
              <View style={styles.macros}>
                {entries.map((e) => (
                  <View key={e.key} style={styles.macro}>
                    <View style={[styles.dot, { backgroundColor: e.color }]} />
                    <Text style={[styles.macroText, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                      {`${e.key} ${formatGrams(e.grams)} g`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {message}
          </Text>
        )}
      </View>
      <Button pill label="Start tracking" onPress={onStart} disabled={!goals || calculating || startDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: PAD_TOP,
    paddingHorizontal: sizing.pageMargin,
    gap: PAD_TOP,
  },
  // Filled height (label 18 + gap 4 + number 36) so the panel does not resize when goals arrive.
  summary: { gap: space.xs, minHeight: 58, justifyContent: 'center' },
  dim: { opacity: 0.5 },
  heading: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_600SemiBold' },
  figures: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  wrap: { flexDirection: 'column', alignItems: 'flex-start' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  kcal: { fontSize: 32, lineHeight: 36, fontFamily: 'Manrope_700Bold', letterSpacing: -0.96 },
  macros: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: space.xs },
  macro: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  macroText: { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
