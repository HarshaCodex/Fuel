import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
  /** Leading icon: a check for success, an alert for an error. No icon when omitted. */
  tone?: 'success' | 'error';
  /** Distance from the bottom of the parent. Defaults to sitting above the add button. */
  bottom?: number;
};

const DEFAULT_BOTTOM = space.lg + sizing.fab + space.md;

/** Short confirmation with one action (Undo or Retry) on the toast surface. Announced to screen readers. */
export function UndoToast({ message, actionLabel, onAction, tone, bottom = DEFAULT_BOTTOM }: Props) {
  const { colors } = useTheme();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.root, shadow.md, { bottom, backgroundColor: colors.toast }]}
    >
      {tone ? (
        <Ionicons
          name={tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
          size={sizing.icon}
          color={tone === 'success' ? colors.toastAction : colors.onToast}
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.icon}
        />
      ) : null}
      <Text style={[type.callout, styles.text, { color: colors.onToast }]} numberOfLines={2} maxFontSizeMultiplier={2}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.action}>
        <Text style={[type.headline, { color: colors.toastAction }]} maxFontSizeMultiplier={2}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    borderRadius: radius.md,
  },
  icon: { marginRight: space.sm },
  text: { flex: 1, paddingVertical: space.md },
  action: { minWidth: sizing.touchMin, minHeight: sizing.touchMin, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
