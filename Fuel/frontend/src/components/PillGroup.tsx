import { StyleSheet, Text, View } from 'react-native';

import { hapticSelect } from '@/lib/haptics';
import { numeric, radius, shadow, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** `switch` is the 40pt muted unit toggle; `accent` is the 44pt goal group with an accent fill. */
  variant?: 'switch' | 'accent';
  disabled?: boolean;
};

const HEIGHT = { switch: 40, accent: 44 } as const;
const PAD = 3;

/** A radio group of two or three pill options. */
export function PillGroup<T extends string>({ options, value, onChange, label, variant = 'switch', disabled }: Props<T>) {
  const { colors, scheme } = useTheme();
  const dark = scheme === 'dark';
  const isSwitch = variant === 'switch';
  const edge = dark ? { borderWidth: 1, borderColor: colors.border } : shadow.sm;
  const track = isSwitch ? { backgroundColor: colors.surfaceMuted } : { backgroundColor: colors.surface, ...edge };
  const pick = (v: T) => {
    if (disabled || v === value) return;
    hapticSelect();
    onChange(v);
  };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { minHeight: HEIGHT[variant] + PAD * 2 }, track, disabled && styles.disabled]}
    >
      {options.map((o) => {
        const on = o.value === value;
        const fill = on ? (isSwitch ? { backgroundColor: colors.surface, ...edge } : { backgroundColor: colors.accent }) : null;
        const textColor = on && !isSwitch ? colors.onAccent : on ? colors.text : colors.textSecondary;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => pick(o.value)}
            style={styles.cell}
            contentStyle={[styles.option, { minHeight: HEIGHT[variant] }, fill]}
          >
            <Text style={[type.label, numeric, { color: textColor }]} maxFontSizeMultiplier={1.5} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, padding: PAD },
  cell: { flex: 1 },
  option: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  disabled: { opacity: 0.5 },
});
