import { StyleSheet, Text, View } from 'react-native';

import type { HistoryDay } from '@/api/tracking';
import { formatKcal } from '@/lib/dashboardView';
import { entriesLabel, isWithinGoal, leftOrOverLabel, longDateLabel } from '@/lib/historyView';
import { space, type, useTheme } from '@/theme';
import { useCardStyle } from './cardStyle';
import { PressableScale } from './PressableScale';

type Props = { date: string; todayIso: string; row: HistoryDay | undefined; onPress: (date: string) => void };

const BAR = 6;
const CARD_RADIUS = 24;

/** The selected day's totals. Tapping a logged day opens it; an empty day is plain and not pressable. */
export function SelectedDayCard({ date, todayIso, row, onPress }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const title = date === todayIso ? 'Today' : longDateLabel(date);
  const head = (
    <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
      {title}
    </Text>
  );
  if (!row) {
    return (
      <View accessible accessibilityLabel={`${title}, no entries`} style={[styles.card, card]}>
        {head}
        <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          No entries
        </Text>
      </View>
    );
  }
  const within = isWithinGoal(row.calories, row.calorieGoal);
  const fraction = row.calorieGoal > 0 ? Math.min(row.calories / row.calorieGoal, 1) : 0;
  const macros = `P ${Math.round(row.protein)} · C ${Math.round(row.carbs)} · F ${Math.round(row.fat)}`;
  const status = row.calorieGoal > 0 ? leftOrOverLabel(row.calories, row.calorieGoal) : '';
  const summary = `${macros}${status ? ` · ${status}` : ''}`;
  const kcal = `${formatKcal(row.calories)} kcal`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${kcal}, ${summary}, ${entriesLabel(row.entryCount)}. Open day`}
      style={[styles.card, card]}
      contentStyle={styles.content}
      onPress={() => onPress(date)}
    >
      <View style={styles.top}>
        {head}
        <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
          {kcal}
        </Text>
      </View>
      <View testID="day-bar" style={[styles.track, { backgroundColor: colors.barTrack }]}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: within ? colors.accent : colors.protein }]} />
      </View>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
        {summary}
      </Text>
      <Text style={[type.caption, { color: colors.accentText }]} maxFontSizeMultiplier={1.5}>
        {entriesLabel(row.entryCount)} ›
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, padding: space.lg, minHeight: 44 },
  content: { gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  track: { height: BAR, borderRadius: BAR / 2, overflow: 'hidden' },
  fill: { height: BAR, borderRadius: BAR / 2 },
});
