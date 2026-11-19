import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { hapticSelect } from '@/lib/haptics';
import { DAILY_CHANGES, isPreset } from '@/lib/setupView';
import { numeric, radius, shadow, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props = { value: number; onSelect: (n: number) => void; onCustom: () => void; disabled?: boolean };

const MIN_HEIGHT = 60;

/** Four equal tiles for the daily calorie change: three presets and Custom. A 2x2 grid at large text sizes. */
export function ChangeTiles({ value, onSelect, onCustom, disabled }: Props) {
  const { colors, scheme } = useTheme();
  const grid = PixelRatio.getFontScale() >= 1.5;
  const preset = isPreset(value);
  const choose = (n: number) => {
    if (n === value) return;
    hapticSelect();
    onSelect(n);
  };
  const custom = () => {
    hapticSelect();
    onCustom();
  };
  const items = [
    ...DAILY_CHANGES.map((c) => ({ key: String(c.value), top: String(c.value), caption: c.label, label: `${c.value} calories a day, ${c.label}`, on: value === c.value, press: () => choose(c.value) })),
    { key: 'custom', top: preset ? 'Custom' : String(value), caption: 'kcal', label: preset ? 'Custom, enter an amount' : `Custom amount, ${value} calories a day`, on: !preset, press: custom },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Daily calorie change"
      style={[styles.row, grid && styles.grid, disabled && styles.disabled]}
    >
      {items.map((t) => (
        <PressableScale
          key={t.key}
          accessibilityRole="radio"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: t.on, disabled: !!disabled }}
          disabled={disabled}
          onPress={t.press}
          style={[styles.cell, grid && styles.gridCell]}
          contentStyle={[
            styles.tile,
            t.on
              ? { backgroundColor: colors.accent }
              : scheme === 'dark'
                ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                : { backgroundColor: colors.surface, ...shadow.sm },
          ]}
        >
          <Text style={[type.value, numeric, { color: t.on ? colors.onAccent : colors.text }]} maxFontSizeMultiplier={2} numberOfLines={1} adjustsFontSizeToFit>
            {t.top}
          </Text>
          <Text
            style={[type.tileCaption, { color: t.on ? colors.onAccent : colors.textSecondary }]}
            maxFontSizeMultiplier={2}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t.caption}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexWrap: 'wrap' },
  cell: { flex: 1 },
  gridCell: { flexBasis: '47%' },
  disabled: { opacity: 0.5 },
  tile: { minHeight: MIN_HEIGHT, borderRadius: radius.option, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
});
