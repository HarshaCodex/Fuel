import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

export type RowMenuAction = { label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean; onPress: () => void };
type Props = { visible: boolean; title: string; actions: RowMenuAction[]; onClose: () => void };

/** Bottom action sheet for a list row. Closes first, then runs the chosen action (after onDismiss on iOS). */
export function RowMenu({ visible, title, actions, onClose }: Props) {
  const { colors } = useTheme();
  const after = useRef<(() => void) | null>(null);

  const runAfter = () => {
    const fn = after.current;
    after.current = null;
    fn?.();
  };
  // iOS cannot present a Modal while another is still dismissing, so wait for onDismiss there.
  const choose = (fn: () => void) => {
    after.current = fn;
    onClose();
    if (Platform.OS !== 'ios') runAfter();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={runAfter}>
      <Pressable accessibilityLabel="Close menu" onPress={onClose} style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View accessibilityViewIsModal style={[styles.sheet, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[type.headline, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={2}>
            {title}
          </Text>
          {actions.map((a) => {
            const color = a.danger ? colors.danger : colors.text;
            return (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={`${a.label} ${title}`}
                onPress={() => choose(a.onPress)}
                style={styles.action}
              >
                <Ionicons name={a.icon} size={sizing.icon} color={color} />
                <Text style={[type.headline, { color }]} maxFontSizeMultiplier={2}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={styles.action}>
            <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', padding: space.lg },
  sheet: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.sm },
  action: { minHeight: sizing.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.md },
});
