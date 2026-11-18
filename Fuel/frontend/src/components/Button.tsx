import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { accentShadow, radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  /** `inverse` is a `text`-coloured fill (Apple); `surface` is a raised white pill (Google). Both suit `pill`. */
  variant?: 'primary' | 'secondary' | 'text' | 'inverse' | 'surface';
  size?: 'lg' | 'md';
  /** Redesigned look: 56pt, fully rounded, springs on press. Default buttons are unchanged. */
  pill?: boolean;
  /** Glyph shown before the label. */
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  pill = false,
  icon,
  loading = false,
  disabled = false,
  testID,
}: Props) {
  const { colors, scheme } = useTheme();
  const inactive = disabled || loading;
  const base = pill && variant !== 'text' ? sizing.pillButton : size === 'lg' ? sizing.buttonLg : sizing.buttonMd;
  const height = Math.max(base, sizing.touchMin);
  const dimmed = disabled && !loading;
  const labelColor = dimmed
    ? colors.textTertiary
    : variant === 'primary'
      ? colors.onAccent
      : variant === 'inverse'
        ? colors.bg
        : variant === 'surface'
          ? colors.text
          : colors.accentText;
  const labelStyle = pill && variant === 'text' ? type.link : type.headline;

  const content = (
    <>
      {/* The label stays in layout (hidden while loading) so the button width never changes. */}
      <View style={[styles.row, loading && styles.hidden]}>
        {icon}
        <Text style={[labelStyle, { color: labelColor }]} maxFontSizeMultiplier={2}>
          {label}
        </Text>
      </View>
      {loading ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.spinner}>
            <ActivityIndicator color={labelColor} />
          </View>
        </View>
      ) : null}
    </>
  );

  if (pill) {
    const fill =
      variant === 'primary'
        ? dimmed
          ? colors.surfaceMuted
          : colors.accent
        : variant === 'inverse'
          ? dimmed
            ? colors.surfaceMuted
            : colors.text
          : variant === 'surface'
            ? colors.surface
            : 'transparent';
    const depth =
      dimmed || scheme === 'dark'
        ? null
        : variant === 'primary'
          ? accentShadow(colors.accent)
          : variant === 'surface'
            ? shadow.sm
            : null;
    return (
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        style={[variant !== 'text' && styles.pillShell, { borderRadius: radius.button }, depth]}
        contentStyle={[
          styles.base,
          {
            minHeight: height,
            backgroundColor: fill,
            borderRadius: radius.button,
          },
          variant === 'text' && styles.textPill,
          variant === 'surface' && scheme === 'dark' && { borderWidth: sizing.border, borderColor: colors.border },
        ]}
      >
        {content}
      </PressableScale>
    );
  }

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
        variant === 'primary' && {
          backgroundColor: dimmed ? colors.surfaceMuted : pressed ? colors.accentPressed : colors.accent,
        },
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: dimmed ? colors.border : colors.accent,
          borderWidth: sizing.border,
        },
        variant === 'text' && { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
        variant === 'inverse' && { backgroundColor: dimmed ? colors.surfaceMuted : colors.text },
        variant === 'surface' && { backgroundColor: colors.surface },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: space.xl },
  pillShell: { alignSelf: 'stretch' },
  textPill: { paddingHorizontal: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  hidden: { opacity: 0 },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
