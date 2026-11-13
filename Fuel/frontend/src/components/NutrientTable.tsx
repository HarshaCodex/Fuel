import { StyleSheet, Text, View } from 'react-native';

import { formatGrams, macroModel, type MacroName } from '@/lib/dashboardView';
import { numeric, radius, space, type, useTheme } from '@/theme';

type Macro = { consumed: number; goal: number };
type Props = { protein: Macro; carbs: Macro; fat: Macro };

const ROWS = [
  ['Protein', 'protein'],
  ['Carbs', 'carbs'],
  ['Fat', 'fat'],
] as const satisfies readonly (readonly [MacroName, 'protein' | 'carbs' | 'fat'])[];

/** Protein, carbs and fat as a table: eaten, goal, left, with a 4px bar under each row. */
export function NutrientTable(props: Props) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.line, styles.head, { borderBottomColor: colors.divider }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {['Nutrient', 'Eaten', 'Goal', 'Left'].map((h, i) => (
          <Text key={h} style={[type.caption, i === 0 ? styles.name : styles.num, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {h}
          </Text>
        ))}
      </View>
      {ROWS.map(([name, key]) => {
        const { consumed, goal } = props[key];
        const m = macroModel(name, { consumed, goal });
        const left = Math.max(0, goal - consumed);
        const over = m.over;
        const leftText = over ? `${formatGrams(consumed - goal)} over` : `${formatGrams(left)} g`;
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${name}, ${m.value} of ${m.goal} grams, ${over ? `${formatGrams(consumed - goal)} over` : `${formatGrams(left)} left`}`}
            style={[styles.row, { borderBottomColor: colors.divider }]}
          >
            <View style={styles.line}>
              <View style={[styles.name, styles.nameCell]}>
                <View style={[styles.dot, { backgroundColor: colors[key] }]} />
                <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                  {name}
                </Text>
              </View>
              <Text style={[type.headline, numeric, styles.num, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
                {`${m.value} g`}
              </Text>
              <Text style={[type.body, numeric, styles.num, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
                {`${m.goal} g`}
              </Text>
              <Text style={[type.headline, numeric, styles.num, { color: over ? colors.caution : colors.accentText }]} maxFontSizeMultiplier={1.5}>
                {leftText}
              </Text>
            </View>
            <View style={[styles.bar, { backgroundColor: colors.track }]}>
              <View
                testID={`bar-${key}`}
                style={[styles.fill, { width: `${Math.round(m.fraction * 100)}%`, backgroundColor: colors[key] }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center' },
  head: { paddingBottom: space.sm, borderBottomWidth: 1 },
  row: { paddingVertical: space.md, borderBottomWidth: 1, gap: space.sm },
  name: { flex: 1.4 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  num: { flex: 1, textAlign: 'right' },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  bar: { height: 4, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.full },
});
