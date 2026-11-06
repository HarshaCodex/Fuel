import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { macroModel, type MacroName } from '@/lib/dashboardView';
import { numeric, radius, space, type, useTheme } from '@/theme';

type Macro = { consumed: number; goal: number };
type Props = { protein: Macro; carbs: Macro; fat: Macro; loading?: boolean };

const items = [
  ['Protein', 'protein'],
  ['Carbs', 'carbs'],
  ['Fat', 'fat'],
] as const satisfies readonly (readonly [MacroName, 'protein' | 'carbs' | 'fat'])[];

/** Three equal macro tiles; they stack when the user's text size is large. */
export function MacroPills({ protein, carbs, fat, loading }: Props) {
  const { colors } = useTheme();
  const values = { protein, carbs, fat };
  const stacked = PixelRatio.getFontScale() >= 1.5;
  return (
    <View style={[styles.row, stacked && styles.column]}>
      {items.map(([name, key]) => {
        const m = macroModel(name, values[key]);
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={loading ? `${name}, loading` : m.label}
            style={[
              styles.tile,
              !stacked && styles.flex,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.head}>
              <View style={[styles.dot, { backgroundColor: colors[key] }]} />
              <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
                {name}
              </Text>
            </View>
            {loading ? (
              <View testID="macro-skeleton" style={[styles.skeleton, { backgroundColor: colors.barTrack }]} />
            ) : (
              <Text style={{ color: colors.textSecondary }} maxFontSizeMultiplier={2}>
                <Text style={[type.headline, numeric, { color: m.over ? colors.caution : colors.text }]}>
                  {m.value}
                </Text>
                <Text style={[type.caption, numeric]}>{` / ${m.goal} g`}</Text>
              </Text>
            )}
            <View style={[styles.bar, { backgroundColor: colors.barTrack }]}>
              <View
                testID={`bar-${key}`}
                style={[
                  styles.fill,
                  { width: `${loading ? 0 : Math.round(m.fraction * 100)}%`, backgroundColor: colors[key] },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  column: { flexDirection: 'column' },
  flex: { flex: 1 },
  tile: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: space.sm,
    justifyContent: 'space-between',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  bar: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  skeleton: { height: 24, width: '60%', borderRadius: radius.sm },
});
