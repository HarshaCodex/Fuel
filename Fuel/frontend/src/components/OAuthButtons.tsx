import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { sizing, space, type, useTheme } from '@/theme';

type Props = {
  disabled?: boolean;
  showApple: boolean;
  /** False in Expo Go, which can't run Google sign-in. */
  showGoogle?: boolean;
  onGoogle: () => void;
  onApple: () => void;
};

/** "or" divider plus the provider buttons. Each button is rendered only when its provider is available. */
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
      {showGoogle ? <Button variant="secondary" label="Continue with Google" disabled={disabled} onPress={onGoogle} /> : null}
      {showApple ? <Button variant="secondary" label="Continue with Apple" disabled={disabled} onPress={onApple} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: sizing.border },
});
