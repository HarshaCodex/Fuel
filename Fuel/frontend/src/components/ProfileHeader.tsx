import { StyleSheet, Text, View } from 'react-native';

import { hapticLight } from '@/lib/haptics';
import { radius, shadow, space, type, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

type Props = { name: string; email: string; onEdit: () => void };

const AVATAR = 52;
const PILL = 40;

/** Avatar initial, name and email on one line each, and an Edit pill. */
export function ProfileHeader({ name, email, onEdit }: Props) {
  const { colors, scheme } = useTheme();
  const initial = (name.trim() || email.trim()).charAt(0).toUpperCase();
  return (
    <View style={styles.root}>
      <View accessible accessibilityLabel={`${name}, ${email}`} style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.initial, { color: colors.accent }]} maxFontSizeMultiplier={1.3}>
            {initial}
          </Text>
        </View>
        <View style={styles.text}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.name, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
            {name}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.email, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
            {email}
          </Text>
        </View>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        hitSlop={space.xs}
        onPress={() => {
          hapticLight();
          onEdit();
        }}
        contentStyle={[
          styles.pill,
          { backgroundColor: colors.surface },
          scheme === 'dark' ? { borderWidth: 1, borderColor: colors.border } : shadow.sm,
        ]}
      >
        <Text style={[type.action, { color: colors.text }]} maxFontSizeMultiplier={1.5}>
          Edit
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, lineHeight: 28, fontFamily: 'Manrope_800ExtraBold' },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 24, lineHeight: 30, fontFamily: 'Manrope_700Bold' },
  email: { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_500Medium' },
  pill: { minWidth: PILL + space.xl, height: PILL, paddingHorizontal: space.lg, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
