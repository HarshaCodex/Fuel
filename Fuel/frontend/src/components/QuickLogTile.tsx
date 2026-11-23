import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useCardStyle } from '@/components/cardStyle';
import { PressableScale } from '@/components/PressableScale';
import { radius, sizing, space, type, useTheme } from '@/theme';

type Props = { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; onPress: () => void };

/** One of the three Quick Log entry methods: icon well over a short label. */
export function QuickLogTile({ icon, label, hint, onPress }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={styles.outer}
      contentStyle={[styles.tile, card]}
    >
      <View style={[styles.well, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={sizing.icon} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <Text style={[type.label, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  tile: {
    minHeight: sizing.tile,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.sm,
  },
  well: { width: sizing.well, height: sizing.well, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
