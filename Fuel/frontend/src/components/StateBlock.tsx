import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { space, type, useTheme } from '@/theme';

type Props = {
  variant: 'empty' | 'error';
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/** Centred empty or error message with one action. The screen supplies the copy. */
export function StateBlock({ variant, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const isError = variant === 'error';
  return (
    <View accessibilityLiveRegion={isError ? 'assertive' : undefined} style={styles.root}>
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'restaurant-outline'}
        size={64}
        color={isError ? colors.danger : colors.textTertiary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text accessibilityRole="header" style={[type.title2, styles.text, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      <Text style={[type.callout, styles.text, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {message}
      </Text>
      <Button variant={isError ? 'secondary' : 'primary'} label={actionLabel} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', alignSelf: 'center', maxWidth: 280, gap: space.md },
  text: { textAlign: 'center' },
});
