import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { useCardStyle } from '@/components/cardStyle';
import { motion, radius, sizing, space, useTheme } from '@/theme';

/** Placeholder with the dashboard's layout. Pulses unless Reduce Motion is on. */
export function DashboardSkeleton() {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

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
  const cardStyle = useCardStyle();
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
        <View testID="skeleton-hero" style={[styles.hero, cardStyle]}>
          <View style={[styles.ring, block]} />
          <View style={[styles.totals, block]} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.tableRow}>
              <View style={[styles.rowName, block]} />
              <View style={[styles.rowBar, block]} />
            </View>
          ))}
        </View>
        <View style={[styles.title, block]} />
        <View testID="skeleton-meal" style={[styles.mealCard, cardStyle]}>
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
  hero: { alignItems: 'center', padding: space.xl, paddingBottom: space.md, borderRadius: radius.xl, gap: space.lg },
  ring: { width: 200, height: 200, borderRadius: radius.full },
  totals: { height: 20, width: 140, borderRadius: radius.md },
  tableRow: { alignSelf: 'stretch', paddingVertical: space.md, gap: space.sm },
  rowName: { height: 20, width: 120, borderRadius: radius.md },
  rowBar: { height: 4, borderRadius: radius.full },
  title: { height: 24, width: 96, borderRadius: radius.md },
  mealCard: { padding: space.md, gap: space.sm, borderRadius: radius.xl },
  row: { height: sizing.row, borderRadius: radius.md },
});
