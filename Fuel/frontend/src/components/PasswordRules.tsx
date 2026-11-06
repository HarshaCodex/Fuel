import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PASSWORD_RULES, PASSWORD_RULES_SUMMARY } from '@/lib/passwordRules';
import { sizing, space, type, useTheme } from '@/theme';

/** Always-visible password rules; each ticks (icon + text, not colour alone) once met. */
export function PasswordRules({ value }: { value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {PASSWORD_RULES_SUMMARY}
      </Text>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <View
            key={rule.id}
            style={styles.row}
            accessible
            accessibilityLabel={`${rule.label}, ${met ? 'met' : 'not met'}`}
          >
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={sizing.icon}
              color={met ? colors.success : colors.textTertiary}
            />
            <Text style={[type.caption, { color: met ? colors.text : colors.textSecondary }]} maxFontSizeMultiplier={2}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
