import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sizing, space, type, useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'lg' | 'md';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', size = 'lg', loading = false, disabled = false, testID }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const height = Math.max(size === 'lg' ? sizing.buttonLg : sizing.buttonMd, sizing.touchMin);
  const labelColor = variant === 'primary' ? colors.onAccent : colors.accentText;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: height },
        variant === 'primary' && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.borderStrong,
          borderWidth: 1.5,
        },
        variant === 'text' && { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
        disabled && !loading && { opacity: 0.5 },
      ]}
    >
      {/* The label stays in layout (hidden while loading) so the button width never changes. */}
      <Text style={[type.headline, { color: labelColor }, loading && styles.hidden]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.spinner}>
            <ActivityIndicator color={labelColor} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: space.xl },
  hidden: { opacity: 0 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
