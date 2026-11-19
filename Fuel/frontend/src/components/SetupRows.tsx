import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { hapticLight } from '@/lib/haptics';
import type { SetupRow, SetupRowKey } from '@/lib/setupView';
import { radius, space, type, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { PressableScale } from './PressableScale';

type Props = {
  rows: SetupRow[];
  onPress: (key: SetupRowKey) => void;
  errors?: Partial<Record<SetupRowKey, string>>;
};

function Row({ row, error, onPress }: { row: SetupRow; error?: string; onPress: (key: SetupRowKey) => void }) {
  const { colors } = useTheme();
  const valueColor = error ? colors.danger : row.value ? colors.textSecondary : colors.accentText;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={error ? `${row.a11y}. ${error}` : row.a11y}
      onPress={() => {
        hapticLight();
        onPress(row.key);
      }}
      contentStyle={styles.row}
    >
      <View style={styles.line}>
        <Text style={[styles.label, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
          {row.label}
        </Text>
        <Text numberOfLines={1} style={[styles.value, { color: valueColor }]} maxFontSizeMultiplier={1.5}>
          {row.value ?? 'Add'}
        </Text>
        <Ionicons testID="row-chevron" name="chevron-forward" size={18} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      {error ? (
        <Text style={[type.caption, { color: colors.danger }]} maxFontSizeMultiplier={1.5}>
          {error}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** The five Setup answers in one card; each row opens its sheet via `onPress(key)`. */
export function SetupRows({ rows, onPress, errors }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  return (
    <View style={[styles.card, card]}>
      {rows.map((row, i) => (
        <Fragment key={row.key}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.divider }]} /> : null}
          <Row row={row} error={errors?.[row.key]} onPress={onPress} />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  row: { minHeight: 50, justifyContent: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { flexGrow: 1, flexShrink: 0, fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_600SemiBold' },
  value: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth },
});
