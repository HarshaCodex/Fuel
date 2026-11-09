import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = { message: string; actionLabel: string; onAction: () => void };

/** Short confirmation with one action (Undo). Sits above the add button; announced to screen readers. */
export function UndoToast({ message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.root, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[type.callout, styles.text, { color: colors.text }]} numberOfLines={2} maxFontSizeMultiplier={2}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.action}>
        <Text style={[type.headline, { color: colors.accent }]} maxFontSizeMultiplier={2}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg + sizing.fab + space.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    borderRadius: radius.md,
    borderWidth: sizing.border,
  },
  text: { flex: 1, paddingVertical: space.md },
  action: { minWidth: sizing.touchMin, minHeight: sizing.touchMin, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
