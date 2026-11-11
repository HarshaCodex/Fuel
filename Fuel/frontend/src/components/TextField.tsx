import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  /** Password-style field with a show/hide toggle. */
  secure?: boolean;
  /** Read-only text inside the right edge, such as a unit. */
  suffix?: string;
  /** Control inside the right edge, such as a clear button. */
  trailing?: ReactNode;
};

export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField(
  { label, error, secure = false, suffix, trailing, editable = true, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.borderStrong;

  return (
    <View style={styles.root}>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      {/* Focus changes this frame's border and shadow. Without collapsable={false}, Android's renderer can rebuild
          the native input under it on focus, which drops focus and everything typed after the first letter. */}
      <View
        collapsable={false}
        style={[
          styles.field,
          {
            backgroundColor: editable ? colors.surface : colors.surfaceMuted,
            borderColor,
            borderWidth: focused ? sizing.borderFocus : sizing.border,
          },
          focused && (scheme === 'dark' ? null : shadow.sm),
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          editable={editable}
          {...rest}
          secureTextEntry={secure && !shown}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            type.body,
            styles.input,
            { color: editable ? colors.text : colors.textTertiary },
            // The field border shows focus; drop the browser's own ring on web.
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            style,
          ]}
          maxFontSizeMultiplier={2}
        />
        {suffix ? (
          <Text style={[type.body, styles.suffix, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {suffix}
          </Text>
        ) : null}
        {trailing}
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            hitSlop={space.xs}
            disabled={!editable}
            onPress={() => setShown((s) => !s)}
            style={styles.toggle}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={sizing.icon} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <Ionicons name="alert-circle-outline" size={type.caption.lineHeight} color={colors.danger} />
          <Text style={[type.caption, styles.errorText, { color: colors.danger }]} maxFontSizeMultiplier={2}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: space.xs },
  field: { minHeight: sizing.input, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  input: { flex: 1, paddingHorizontal: space.lg, minHeight: sizing.input },
  suffix: { paddingRight: space.lg },
  toggle: { minWidth: sizing.touchMin, minHeight: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  errorText: { flex: 1 },
});
