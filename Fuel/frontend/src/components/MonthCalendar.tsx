import { StyleSheet, Text, View } from 'react-native';

import type { HistoryDay } from '@/api/tracking';
import { cellA11yLabel, dayState, monthGrid } from '@/lib/historyView';
import { radius, sizing, space, type, useTheme } from '@/theme';
import { useCardStyle } from './cardStyle';
import { DayRing } from './DayRing';
import { PressableScale } from './PressableScale';

type Props = {
  year: number;
  /** 1 to 12. */
  month: number;
  rows: HistoryDay[];
  todayIso: string;
  selected: string;
  loading?: boolean;
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A month as a Monday-first grid of day rings, with a legend. Future days are disabled. */
export function MonthCalendar({ year, month, rows, todayIso, selected, loading, onSelect }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const legend = [
    { label: 'Within goal', color: colors.accent },
    { label: 'Over goal', color: colors.protein },
    { label: 'No logs', color: colors.track, hollow: true },
  ];
  return (
    <View style={[styles.card, card]}>
      <View style={styles.week}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[type.tileCaption, styles.head, styles.headBold, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {d}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />;
            const row = byDate.get(date);
            const { state, fraction } = dayState(date, row, todayIso);
            const isSelected = date === selected;
            const isToday = date === todayIso;
            const disabled = state === 'future' || !!loading;
            return (
              <PressableScale
                key={i}
                style={styles.cell}
                contentStyle={styles.press}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={cellA11yLabel(date, row, todayIso)}
                accessibilityState={{ selected: isSelected, disabled }}
                onPress={() => onSelect(date)}
              >
                <View collapsable={false} style={[styles.well, isSelected && { backgroundColor: colors.accentSoft }]}>
                  <DayRing day={Number(date.slice(8))} state={loading && state !== 'future' ? 'skeleton' : state} fraction={fraction} />
                </View>
                <View testID={isToday ? 'today-dot' : undefined} style={[styles.dot, { backgroundColor: isToday ? colors.accent : 'transparent' }]} />
              </PressableScale>
            );
          })}
        </View>
      ))}
      <View style={[styles.rule, { backgroundColor: colors.divider }]} />
      <View style={styles.legend}>
        {legend.map((l) => (
          <View key={l.label} style={styles.key}>
            <View style={[styles.swatch, l.hollow ? { borderWidth: 2, borderColor: l.color } : { backgroundColor: l.color }]} />
            <Text style={[type.caption, { color: colors.textSecondary }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, paddingHorizontal: space.sm, paddingVertical: space.lg },
  week: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', paddingBottom: space.sm },
  cell: { flex: 1, minHeight: sizing.touchMin },
  press: { minHeight: sizing.touchMin, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  well: { width: sizing.touchMin, height: sizing.touchMin, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  rule: { height: 1, marginTop: space.md, marginBottom: space.md },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.lg },
  key: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  headBold: { fontFamily: 'Manrope_700Bold' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
