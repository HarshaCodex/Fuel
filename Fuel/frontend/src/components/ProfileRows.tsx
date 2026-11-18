import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { hapticLight } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';
import { PressableScale } from './PressableScale';

type Props = {
  /** My Foods count as text; undefined while loading or on error. */
  customFoods?: string;
  appearance: string;
  onMyFoods: () => void;
  onAppearance: () => void;
  onSignOut: () => void;
};

const WELL = 36;

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  a11y: string;
  value?: string;
  chevron?: boolean;
  neutral?: boolean;
  onPress: () => void;
};

function Row({ icon, label, a11y, value, chevron = true, neutral, onPress }: RowProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      contentStyle={styles.row}
    >
      <View style={[styles.well, { backgroundColor: neutral ? colors.surfaceMuted : colors.accentSoft }]}>
        <Ionicons name={icon} size={20} color={neutral ? colors.textSecondary : colors.accentText} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <Text style={[styles.label, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={[styles.value, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
          {value}
        </Text>
      ) : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </PressableScale>
  );
}

/** My Foods, Appearance and Sign out in one card with hairline dividers. */
export function ProfileRows({ customFoods, appearance, onMyFoods, onAppearance, onSignOut }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const rows: RowProps[] = [
    { icon: 'restaurant-outline', label: 'My Foods', a11y: 'My Foods', value: customFoods, onPress: onMyFoods },
    { icon: 'contrast-outline', label: 'Appearance', a11y: `Appearance. ${appearance}`, value: appearance, onPress: onAppearance },
    { icon: 'log-out-outline', label: 'Sign out', a11y: 'Sign out', chevron: false, neutral: true, onPress: onSignOut },
  ];
  return (
    <View style={[styles.card, card]}>
      {rows.map((r, i) => (
        <Fragment key={r.label}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          <Row {...r} />
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.sheet, overflow: 'hidden' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  well: { width: WELL, height: WELL, borderRadius: WELL / 2, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: 'Manrope_600SemiBold' },
  value: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + WELL + space.md },
});
