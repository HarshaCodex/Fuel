import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider, useKeyboardHeight } from '@/components/KeyboardAvoider';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, radius, shadow, sizing, space, useTheme } from '@/theme';

import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The 56pt action slot under the content. Omit for a sheet that closes on selection. */
  done?: { label?: string; disabled?: boolean; onPress: () => void };
};

const SLIDE_FROM = 320;

/** Modal bottom sheet: slides up (fades with Reduce Motion), closes on scrim tap or Android back. */
export function BottomSheet({ visible, title, onClose, children, done }: Props) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const keyboardUp = useKeyboardHeight() > 0;
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: motion.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);

  const animated = reduce
    ? { opacity: progress }
    : { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_FROM, 0] }) }] };
  const edge = scheme === 'dark' ? { borderWidth: sizing.border, borderColor: colors.border } : shadow.sheet;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoider style={styles.flex}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={[styles.scrim, { backgroundColor: colors.sheetScrim }]} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            edge,
            { backgroundColor: colors.surface, paddingBottom: keyboardUp ? space.lg : Math.max(insets.bottom, space.lg) },
            animated,
          ]}
        >
          <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={[styles.title, { color: colors.text }]}>
              {title}
            </Text>
            {children}
          </ScrollView>
          {done ? (
            <View style={styles.footer}>
              <Button pill label={done.label ?? 'Done'} onPress={done.onPress} disabled={done.disabled} />
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: '90%' },
  grabber: { width: sizing.grabber.width, height: sizing.grabber.height, borderRadius: radius.full, alignSelf: 'center', marginTop: space.sm },
  content: { padding: space.lg, gap: space.lg },
  title: { fontSize: 24, lineHeight: 30, fontFamily: 'Manrope_700Bold' },
  footer: { paddingHorizontal: space.lg },
});
