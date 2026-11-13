import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardEntry } from '@/api/tracking';
import { radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { MealEntryRow } from './MealEntryRow';

type Props = {
  title: string;
  entries: DashboardEntry[];
  onDeleteEntry: (entry: DashboardEntry) => void;
  onEditEntry: (entry: DashboardEntry) => void;
};

/** One meal as a soft card: title, then its rows with swipe, long press and the menu button. */
export function MealCard({ title, entries, onDeleteEntry, onEditEntry }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  return (
    <View style={[styles.card, card]}>
      <Text accessibilityRole="header" style={[type.headline, styles.title, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      {entries.map((e, i) => (
        <Fragment key={e.id}>
          {i > 0 ? <View testID="meal-divider" style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
          <MealEntryRow scale entry={e} onDelete={() => onDeleteEntry(e)} onEdit={() => onEditEntry(e)} />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', paddingTop: space.lg },
  title: { paddingHorizontal: space.lg, paddingBottom: space.xs },
  divider: { height: 1, marginHorizontal: space.lg },
});
