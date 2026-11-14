import { useCallback, useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useKeyboardHeight } from '@/components/KeyboardAvoider';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, radius, shadow, sizing, space, useTheme } from '@/theme';

/** A drag past this distance, or a fling faster than this, dismisses the sheet. */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 800;
const SHEET_HEIGHT = 0.88;

type Props = {
  /** Called once the exit animation has finished. The screen should leave the stack here. */
  onClose: () => void;
  /** Receives `close`, which plays the exit animation and then calls `onClose`. */
  children: (close: () => void) => ReactNode;
};

/**
 * Bottom sheet over the current screen: scrim, 28pt top radius, grabber. Closes by scrim tap, grabber drag,
 * Android back or `close`. With Reduce Motion on it fades instead of sliding.
 */
export function QuickLogSheet({ onClose, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const closing = useSharedValue(false);
  const slide = !reduce;

  useEffect(() => {
    progress.set(withTiming(1, { duration: motion.base }));
  }, [progress]);

  const close = useCallback(() => {
    if (closing.get()) return;
    closing.set(true);
    progress.set(
      withTiming(0, { duration: motion.base }, (finished) => {
        if (finished) scheduleOnRN(onClose);
      }),
    );
  }, [progress, closing, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      drag.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(close);
      } else {
        drag.value = withSpring(0);
      }
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() =>
    slide
      ? { transform: [{ translateY: (1 - progress.value) * screenHeight + drag.value }] }
      : { opacity: progress.value, transform: [{ translateY: drag.value }] },
  );

  const lift = Platform.OS === 'ios' ? keyboard : 0;
  const height = Math.min(screenHeight * SHEET_HEIGHT, screenHeight - lift - insets.top - space.md);

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.sheetScrim }, scrimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close Quick Log" onPress={close} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          shadow.sheet,
          {
            height,
            marginBottom: lift,
            backgroundColor: colors.bg,
            borderColor: colors.sheetEdge,
            paddingBottom: keyboard > 0 ? space.sm : Math.max(insets.bottom, space.lg),
          },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View collapsable={false} style={styles.grabZone} testID="sheet-grabber">
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.grabber, { backgroundColor: colors.borderStrong }]}
            />
          </View>
        </GestureDetector>
        {children(close)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabZone: { height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: sizing.grabber.width, height: sizing.grabber.height, borderRadius: radius.full },
});
