import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { FoodSource } from '@/api/tracking';
import { sourceLabel } from '@/lib/dashboardView';
import { radius, space, type, useTheme } from '@/theme';

/** Icon and text are always shown together, so meaning never rests on colour. */
export function TrustBadge({ source }: { source: FoodSource }) {
  const { colors } = useTheme();
  const look = {
    USDA: {
      icon: 'checkmark-circle',
      fg: colors.success,
      bg: colors.successSoft,
    },
    OFF: { icon: 'pricetag', fg: colors.info, bg: colors.infoSoft },
    USER: { icon: 'pencil', fg: colors.accentText, bg: colors.accentSoft },
  } as const;
  const { icon, fg, bg } = look[source];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons
        name={icon}
        size={16}
        color={fg}
        accessible={false}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <Text style={[type.caption, { color: fg }]} maxFontSizeMultiplier={1.3}>
        {sourceLabel(source)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
});
