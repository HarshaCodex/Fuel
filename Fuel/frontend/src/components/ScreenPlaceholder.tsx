import { StyleSheet, Text, View } from 'react-native';

import { numeric, space, type, useTheme } from '@/theme';

type Props = { title: string; purpose: string };

/** Temporary body for screens that are not built yet. */
export function ScreenPlaceholder({ title, purpose }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]} testID="screen-placeholder">
      <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {title}
      </Text>
      <Text style={[type.body, numeric, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {purpose}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xxxl, gap: space.sm },
});
