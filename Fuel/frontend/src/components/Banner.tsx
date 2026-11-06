import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { radius, sizing, space, type, useTheme } from '@/theme';

type Variant = 'caution' | 'info' | 'success' | 'danger';
type Props = { variant: Variant; message: string; action?: { label: string; onPress: () => void } };

const icons: Record<Variant, keyof typeof Ionicons.glyphMap> = {
  caution: 'warning-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  danger: 'alert-circle-outline',
};

/** Inline message with an icon (never colour alone) and an optional action such as Retry. */
export function Banner({ variant, message, action }: Props) {
  const { colors } = useTheme();
  const fg = colors[variant];
  const bg = colors[`${variant}Soft` as const];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.row}>
        <Ionicons name={icons[variant]} size={sizing.icon} color={fg} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={[type.callout, styles.text, { color: fg }]} maxFontSizeMultiplier={2}>
          {message}
        </Text>
      </View>
      {action ? <Button variant="text" size="md" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  text: { flex: 1 },
});
