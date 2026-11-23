import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardEntry } from '@/api/tracking';
import { groupByMeal } from '@/lib/dashboardView';
import { radius, space, type, useTheme } from '@/theme';

import { MealEntryRow } from './MealEntryRow';
import { MealRow } from './MealRow';

type Props = { entries: DashboardEntry[]; onDeleteEntry?: (entry: DashboardEntry) => void; onEditEntry?: (entry: DashboardEntry) => void };

/** Entries grouped by meal, one card per group. Rows get swipe and menu actions when a handler is given. */
export function MealList({ entries, onDeleteEntry, onEditEntry }: Props) {
  const { colors } = useTheme();
  const groups = groupByMeal(entries);
  if (groups.length === 0) return null;
  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={[type.caption, { color: colors.textSecondary }]} accessibilityRole="header">
            {g.title}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {g.entries.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 && (
                  <View testID="meal-divider" style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
                {onDeleteEntry ? (
                  <MealEntryRow
                    entry={e}
                    onDelete={() => onDeleteEntry(e)}
                    onEdit={onEditEntry ? () => onEditEntry(e) : undefined}
                  />
                ) : (
                  <MealRow
                    name={e.foodName}
                    source={e.source}
                    loggedAt={e.loggedAt}
                    calories={e.calories}
                    protein={e.protein}
                    carbs={e.carbs}
                    fat={e.fat}
                    mealLabel={e.mealLabel}
                  />
                )}
              </Fragment>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  group: { gap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
});
