import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { sizing, space, type, useTheme } from '@/theme';

// Google's brand blue; the glyph is the only place it appears.
const GOOGLE_BLUE = '#4285F4';

type Props = {
  disabled?: boolean;
  showApple: boolean;
  /** False in Expo Go, which can't run Google sign-in. */
  showGoogle?: boolean;
  onGoogle: () => void;
  onApple: () => void;
};

/** "or" divider plus the provider buttons (Apple first, as in the mockup). Each button is rendered only when its provider is available. */
export function OAuthButtons({ disabled = false, showApple, showGoogle = true, onGoogle, onApple }: Props) {
  const { colors } = useTheme();
  if (!showGoogle && !showApple) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.divider} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          or
        </Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      {showApple ? (
        <Button
          pill
          variant="inverse"
          label="Continue with Apple"
          icon={<Ionicons name="logo-apple" size={sizing.icon - space.xs} color={disabled ? colors.textTertiary : colors.bg} />}
          disabled={disabled}
          onPress={onApple}
        />
      ) : null}
      {showGoogle ? (
        <Button
          pill
          variant="surface"
          label="Continue with Google"
          icon={<Ionicons name="logo-google" size={sizing.icon - space.xs} color={disabled ? colors.textTertiary : GOOGLE_BLUE} />}
          disabled={disabled}
          onPress={onGoogle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: sizing.border },
});
