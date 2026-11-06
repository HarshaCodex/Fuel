import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sizing, space, type, useTheme } from '@/theme';

type Props<T extends string> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Two to three exclusive choices in one row. Each segment is a radio for screen readers. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, disabled = false }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(o.value)}
              style={[styles.segment, selected && { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: sizing.border }]}
            >
              <Text style={[type.headline, { color: selected ? colors.accentText : colors.textSecondary }]} maxFontSizeMultiplier={2}>
                {o.label}
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
  track: { flexDirection: 'row', borderRadius: radius.md, padding: space.xs, gap: space.xs },
  segment: {
    flex: 1,
    minHeight: sizing.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: sizing.border,
    borderColor: 'transparent',
  },
});
