import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { accentShadow, radius, sizing, space, type, useTheme } from '@/theme';

/** App mark, wordmark and tagline for the sign-in screen. */
export function BrandMark() {
  const { colors, scheme } = useTheme();
  return (
    <View style={styles.root}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.mark, { backgroundColor: colors.accent }, scheme === 'dark' ? null : accentShadow(colors.accent)]}
      >
        <Ionicons name="flame-outline" size={sizing.icon + space.sm} color={colors.onAccent} />
      </View>
      <Text style={[type.brand, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Fuel
      </Text>
      <Text style={[type.tagline, styles.tagline, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        Track what you eat, simply.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.xs },
  mark: {
    width: sizing.brandMark,
    height: sizing.brandMark,
    borderRadius: radius.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  tagline: { textAlign: 'center' },
});
