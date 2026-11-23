import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sizing, space, type, useTheme } from '@/theme';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Text shown between the buttons; defaults to the number. */
  disabled?: boolean;
  format?: (value: number) => string;
};

/** Minus / value / plus control that clamps to [min, max]. */
export function Stepper({ label, value, min, max, step, onChange, disabled = false, format = String }: Props) {
  const { colors } = useTheme();
  const button = (name: 'remove' | 'add', text: string, next: number, atLimit: boolean) => {
    const off = atLimit || disabled;
    return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text} ${label}`}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => onChange(next)}
      style={[styles.button, { borderColor: off ? colors.border : colors.accent }]}
    >
      <Ionicons name={name} size={sizing.icon} color={off ? colors.textTertiary : colors.accentText} />
    </Pressable>
  );
  };
  return (
    <View style={styles.root}>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <View style={styles.row}>
        {button('remove', 'Decrease', Math.max(min, value - step), value <= min)}
        <Text
          style={[type.headline, styles.value, { color: colors.text }]}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={2}
        >
          {format(value)}
        </Text>
        {button('add', 'Increase', Math.min(max, value + step), value >= max)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  value: { flex: 1, textAlign: 'center' },
  button: {
    width: sizing.touchMin,
    height: sizing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: sizing.border,
  },
});
