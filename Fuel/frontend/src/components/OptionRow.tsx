import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, sizing, space, type, useTheme } from '@/theme';

type Props = { label: string; description: string; selected: boolean; onPress: () => void };

/** One radio row with a title and a plain description. */
export function OptionRow({ label, description, selected, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={sizing.icon}
        color={selected ? colors.accent : colors.textSecondary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.text}>
        <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {label}
        </Text>
        <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: sizing.row,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: sizing.border,
  },
  text: { flex: 1, gap: space.xs },
});
