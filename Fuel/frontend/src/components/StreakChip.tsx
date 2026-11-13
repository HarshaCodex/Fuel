import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';

/** Quiet streak pill. Hidden at zero so a broken streak is never shown as a failure. */
export function StreakChip({ current }: { current: number }) {
  const { colors } = useTheme();
  const card = useCardStyle();
  if (!(current > 0)) return null;
  const n = current.toLocaleString('en-US');
  const text = `${n} ${current === 1 ? 'day' : 'days'}`;
  return (
    <View accessible accessibilityLabel={`${n} day streak`} style={[styles.root, card]}>
      <Ionicons name="flame" size={16} color={colors.protein} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
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
