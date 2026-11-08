import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PixelRatio, StyleSheet, View } from 'react-native';

import { motion, radius, sizing, space, useTheme } from '@/theme';

/** Placeholder with the dashboard's layout. Pulses unless Reduce Motion is on. */
export function DashboardSkeleton() {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  const stacked = PixelRatio.getFontScale() >= 1.5;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => alive && setReduceMotion(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const half = motion.shimmer / 2;
    const step = (toValue: number) =>
      Animated.timing(pulse, { toValue, duration: half, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const animation = Animated.loop(Animated.sequence([step(0.5), step(1)]));
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, pulse]);

  const block = { backgroundColor: colors.surfaceMuted };
  const card = { backgroundColor: colors.surface, borderColor: colors.border };
  return (
    <View
      accessible
      accessibilityLabel="Loading your day"
      accessibilityRole="progressbar"
      importantForAccessibility="yes"
      style={styles.root}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.root, { opacity: pulse }]}
      >
        <View style={[styles.ringCard, card]}>
          <View style={[styles.ring, block]} />
        </View>
        <View style={[styles.tiles, stacked && styles.column]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.tile, !stacked && styles.flex, block]} />
          ))}
        </View>
        <View style={[styles.title, block]} />
        <View style={[styles.mealCard, card]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.row, block]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  ringCard: { alignItems: 'center', padding: space.xl, borderRadius: radius.lg, borderWidth: 1 },
  ring: { width: 200, height: 200, borderRadius: radius.full },
  tiles: { flexDirection: 'row', gap: space.sm },
  column: { flexDirection: 'column' },
  flex: { flex: 1 },
  tile: { height: 88, borderRadius: radius.md },
  title: { height: 24, width: 96, borderRadius: radius.md },
  mealCard: { padding: space.md, gap: space.sm, borderRadius: radius.lg, borderWidth: 1 },
  row: { height: sizing.row, borderRadius: radius.md },
});
