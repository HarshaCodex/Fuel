import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

/** Quiet streak pill. Hidden at zero so a broken streak is never shown as a failure. */
export function StreakChip({ current }: { current: number }) {
  const { colors } = useTheme();
  if (!(current > 0)) return null;
  const text = `${current.toLocaleString('en-US')} day streak`;
  return (
    <View accessible accessibilityLabel={text} style={[styles.root, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name="flame" size={16} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
  },
});
