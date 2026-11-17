import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { BodyStats } from '@/api/user';
import { hapticLight } from '@/lib/haptics';
import { bodyStatColumns, bodyStatsA11y } from '@/lib/profileView';
import { numeric, radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { PressableScale } from './PressableScale';

type Props = { stats: BodyStats | null; onPress: () => void };

export const BODY_STATS_EMPTY = 'Add your height, weight, age and activity so Fuel can suggest goals for you.';

/** Height, weight, age and activity; the whole card opens Edit body stats. `null` offers Add body stats. */
export function BodyStatsCard({ stats, onPress }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const press = () => {
    hapticLight();
    onPress();
  };
  const heading = (
    <View style={styles.head}>
      <Text style={[type.eyebrow, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
        Body stats
      </Text>
      {stats ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
    </View>
  );

  if (!stats) {
    return (
      <View style={[styles.card, card]}>
        {heading}
        <Text style={[styles.empty, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          {BODY_STATS_EMPTY}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Add body stats"
          onPress={press}
          contentStyle={[styles.button, { backgroundColor: colors.accentSoft }]}
        >
          <Text style={[styles.buttonText, { color: colors.accentText }]} maxFontSizeMultiplier={1.5}>
            Add body stats
          </Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={bodyStatsA11y(stats)}
      onPress={press}
      contentStyle={[styles.card, card]}
    >
      {heading}
      <View style={styles.cols}>
        {bodyStatColumns(stats).map((c) => (
          <View key={c.label} style={styles.col}>
            <Text style={[styles.value, numeric, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
              {c.value}
            </Text>
            <Text style={[type.tileCaption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 20, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cols: { flexDirection: 'row', gap: space.sm },
  col: { flex: 1, minWidth: 0, gap: 2 },
  value: { fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_700Bold' },
  empty: { fontSize: 15, lineHeight: 22, fontFamily: 'Manrope_400Regular' },
  button: { minHeight: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
});
