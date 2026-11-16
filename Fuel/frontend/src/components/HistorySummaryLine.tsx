import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/dashboardView';
import type { HistorySummaryModel } from '@/lib/historyView';
import { space, type, useTheme } from '@/theme';

type Props = HistorySummaryModel & { streak: number };

/** One quiet line under the card: average, days on goal and the streak (hidden at 0). */
export function HistorySummaryLine({ averageCalories, daysLogged, daysOnGoal, streak }: Props) {
  const { colors } = useTheme();
  const text = [type.caption, { color: colors.textSecondary }];
  const days = `${streak} ${streak === 1 ? 'day' : 'days'}`;
  return (
    <View style={styles.row}>
      <Text accessibilityLabel={`Average ${formatKcal(averageCalories)} calories`} style={text} maxFontSizeMultiplier={1.5}>
        Avg {formatKcal(averageCalories)} kcal
      </Text>
      <Text accessibilityLabel={`On goal ${daysOnGoal} of ${daysLogged} days`} style={text} maxFontSizeMultiplier={1.5}>
        On goal {daysOnGoal} of {daysLogged}
      </Text>
      {streak > 0 ? (
        <View accessible accessibilityLabel={`Streak, ${days}`} style={styles.streak}>
          <Ionicons name="flame" size={14} color={colors.protein} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={text} maxFontSizeMultiplier={1.5}>
            {days}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.lg, rowGap: space.xs },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
