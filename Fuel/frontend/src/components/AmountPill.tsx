import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { numeric, radius, sizing, space, type, useTheme } from '@/theme';

type Props = { value: string; onChangeText: (text: string) => void; unit: string; error?: string | null; onBlur?: () => void };

/** The custom-amount field: "Amount" on the left, the number and its unit on the right. Focuses itself when shown. */
export function AmountPill({ value, onChangeText, unit, error, onBlur }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {/* collapsable={false}: the style changes on focus, and Android would rebuild the native input (#207). */}
      <View
        collapsable={false}
        style={[
          styles.pill,
          { backgroundColor: colors.surface, borderColor: focused ? colors.accent : 'transparent' },
        ]}
      >
        <Text style={[type.label, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          Amount
        </Text>
        <View style={styles.right}>
          <TextInput
            autoFocus
            accessibilityLabel={`Amount in ${unit}`}
            keyboardType="decimal-pad"
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            selectTextOnFocus
            maxFontSizeMultiplier={2}
            style={[type.amount, styles.input, numeric, { color: colors.text }]}
          />
          <Text style={[type.amount, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {unit}
          </Text>
        </View>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[type.caption, styles.error, { color: colors.danger }]} maxFontSizeMultiplier={2}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  pill: {
    minHeight: sizing.field,
    borderRadius: radius.sheet,
    borderWidth: sizing.borderFocus,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  input: { minWidth: 48, textAlign: 'right', padding: 0 },
  error: { paddingHorizontal: space.lg },
});
