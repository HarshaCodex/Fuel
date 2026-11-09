import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ServingUnit } from '@/api/food';
import { UNITS } from '@/lib/customFoodForm';
import { radius, sizing, space, type, useTheme } from '@/theme';

type Props = {
  label: string;
  value: ServingUnit;
  onChange: (unit: ServingUnit) => void;
  disabled?: boolean;
};

/** Wrapping chips for the serving units. Each chip is a radio for screen readers. */
export function UnitPicker({ label, value, onChange, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.wrap}>
        {UNITS.map((unit) => {
          const selected = unit === value;
          return (
            <Pressable
              key={unit}
              accessibilityRole="radio"
              accessibilityLabel={unit}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(unit)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted,
                  borderColor: selected ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[type.callout, { color: selected ? colors.accentText : colors.text }]}
                maxFontSizeMultiplier={2}
              >
                {unit}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minWidth: sizing.touchMin,
    minHeight: sizing.touchMin,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: sizing.border,
  },
});
