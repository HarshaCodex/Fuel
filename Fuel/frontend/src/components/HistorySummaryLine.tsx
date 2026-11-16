import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import type { HistorySummaryModel } from '@/lib/historyView';
import { space, type, useTheme } from '@/theme';

type Props = HistorySummaryModel & { streak: number };

/** One line under the card: average, days on goal and the streak (hidden at 0). Nothing but the streak for an empty month. */
export function HistorySummaryLine({ averageCalories, daysLogged, daysOnGoal, streak }: Props) {
  const { colors } = useTheme();
  const label = [type.callout, { color: colors.textSecondary }];
  const figure = [type.callout, styles.figure, { color: colors.text }];
  const days = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  return (
    <View style={styles.row}>
      {daysLogged > 0 ? (
        <>
          <Text accessibilityLabel={`Average ${formatKcal(averageCalories)} calories`} style={label} maxFontSizeMultiplier={1.5}>
            Avg <Text style={figure}>{formatKcal(averageCalories)}</Text> kcal
          </Text>
          <Text accessibilityLabel={`On goal ${daysOnGoal} of ${daysLogged} days`} style={label} maxFontSizeMultiplier={1.5}>
            On goal <Text style={figure}>{`${daysOnGoal} of ${daysLogged}`}</Text>
          </Text>
        </>
      ) : null}
      {streak > 0 ? (
        <View accessible accessibilityLabel={`Streak, ${days}`} style={styles.streak}>
          <Ionicons name="flame" size={14} color={colors.protein} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={label} maxFontSizeMultiplier={1.5}>
            <Text style={figure}>{streak}</Text> {streak === 1 ? 'day' : 'days'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space.lg, rowGap: space.xs, paddingHorizontal: space.lg },
  figure: { fontFamily: 'Manrope_700Bold' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
