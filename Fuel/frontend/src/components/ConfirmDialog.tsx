import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal confirmation. A real Modal rather than Alert, which does nothing on web. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, scheme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.card, shadow.md, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text accessibilityRole="header" style={[type.title2, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {title}
          </Text>
          {message ? (
            <Text style={[type.body, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
              {message}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button variant="secondary" label={cancelLabel} onPress={onCancel} disabled={loading} />
            {danger ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                accessibilityState={{ disabled: loading, busy: loading }}
                disabled={loading}
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.danger,
                  { backgroundColor: colors.danger, opacity: loading ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[type.headline, { color: scheme === 'dark' ? colors.bg : colors.onAccent }]} maxFontSizeMultiplier={2}>
                  {confirmLabel}
                </Text>
              </Pressable>
            ) : (
              <Button label={confirmLabel} onPress={onConfirm} loading={loading} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: sizing.border, padding: space.xl, gap: space.md },
  actions: { gap: space.sm, marginTop: space.sm },
  danger: { minHeight: sizing.buttonLg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: space.xl },
});
