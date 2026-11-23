import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { shadow, sizing, space, type, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** Shows a round Back button at the top. */
  onBack?: () => void;
  title?: string;
  /** Secondary line under the title. */
  subtitle?: string;
  /** Announce subtitle changes to screen readers. */
  subtitleLive?: boolean;
  /** Pinned under the scroll area, such as a "New to Fuel?" link. */
  footer?: ReactNode;
  /** Centre the content vertically in the space above the footer. */
  centered?: boolean;
};

/** Shared scroll + keyboard-avoiding container for the auth screens. */
export function AuthScreen({ children, onBack, title, subtitle, subtitleLive, footer, centered = false }: Props) {
  const { colors, scheme } = useTheme();
  return (
    <KeyboardAvoider style={{ backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, centered && styles.centered]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={[
              styles.back,
              { backgroundColor: colors.surface },
              scheme === 'dark' ? { borderWidth: 1, borderColor: colors.border } : shadow.sm,
            ]}
          >
            <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
          </Pressable>
        ) : null}
        {title ? (
          <View style={styles.titleGroup}>
            <Text style={[type.authTitle, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[type.callout, { color: colors.textSecondary }]}
                accessibilityLiveRegion={subtitleLive ? 'polite' : undefined}
                maxFontSizeMultiplier={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: space.xl, paddingTop: space.xxxl, gap: space.lg },
  titleGroup: { gap: space.xs },
  centered: { justifyContent: 'center' },
  back: {
    width: sizing.touchMin,
    height: sizing.touchMin,
    borderRadius: sizing.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: space.xl },
});
