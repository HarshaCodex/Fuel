import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text } from 'react-native';

import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

/** The one primary action on Today: a bottom-right pill. */
export function LogFoodButton({ onPress }: { onPress: () => void }) {
  const { colors, scheme } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Log food"
      onPress={onPress}
      style={[styles.pill, scheme === 'dark' ? null : shadow.lg, { backgroundColor: colors.accent }]}
      contentStyle={styles.content}
    >
      <Ionicons name="add" size={sizing.icon} color={colors.onAccent} />
      <Text style={[type.headline, { color: colors.onAccent }]} maxFontSizeMultiplier={1.3}>
        Log food
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    borderRadius: radius.full,
  },
  content: {
    minHeight: sizing.fab,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
});
