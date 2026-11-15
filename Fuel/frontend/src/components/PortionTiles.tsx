import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import type { Food } from '@/api/food';
import { hapticSelect } from '@/lib/haptics';
import { portionTiles, type PortionKey } from '@/lib/portion';
import { numeric, radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

export type PortionChoice = PortionKey | 'custom';
type Props = { food: Food; selected: PortionChoice; onSelect: (choice: PortionChoice) => void };

/** Four equal portion tiles (half, one, one and a half servings, custom). Becomes a 2x2 grid at large text sizes. */
export function PortionTiles({ food, selected, onSelect }: Props) {
  const { colors, scheme } = useTheme();
  const grid = PixelRatio.getFontScale() >= 1.5;
  const items: { key: PortionChoice; top: string; caption: string; label: string }[] = [
    ...portionTiles(food).map((t) => ({
      key: t.key,
      top: t.amountLabel,
      caption: t.caption,
      label: `${t.amountLabel}, ${t.caption}`,
    })),
    { key: 'custom', top: 'Custom', caption: 'type amount', label: 'Custom, type amount' },
  ];
  const choose = (key: PortionChoice) => {
    if (key === selected) return;
    hapticSelect();
    onSelect(key);
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Portion" style={[styles.row, grid && styles.grid]}>
      {items.map((t) => {
        const on = t.key === selected;
        return (
          <PressableScale
            key={t.key}
            accessibilityRole="radio"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => choose(t.key)}
            style={[styles.cell, grid && styles.gridCell]}
            contentStyle={[
              styles.tile,
              on
                ? { backgroundColor: colors.accent }
                : scheme === 'dark'
                  ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                  : { backgroundColor: colors.surface, ...shadow.sm },
            ]}
          >
            <Text
              style={[type.value, numeric, { color: on ? colors.onAccent : colors.text }]}
              maxFontSizeMultiplier={2}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t.top}
            </Text>
            <Text
              style={[type.tileCaption, { color: on ? colors.onAccent : colors.textSecondary }]}
              maxFontSizeMultiplier={2}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t.caption}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexWrap: 'wrap' },
  cell: { flex: 1 },
  gridCell: { flexBasis: '47%' },
  tile: {
    minHeight: sizing.portionTile,
    borderRadius: radius.option,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
});
