import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useReduceMotion } from '@/lib/useReduceMotion';
import { motion, radius, space, useTheme } from '@/theme';

import { useCardStyle } from './cardStyle';

type Props = { /** Which placeholders to show. */ header?: boolean; goals?: boolean; body?: boolean };

/** Placeholders with the header, goal card and body stats card shapes. Pulses unless Reduce Motion is on. */
export function ProfileSkeleton({ header = false, goals = false, body = false }: Props) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce) {
      pulse.setValue(1);
      return;
    }
    const step = (toValue: number) =>
      Animated.timing(pulse, { toValue, duration: motion.shimmer / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([step(0.5), step(1)]));
    loop.start();
    return () => loop.stop();
  }, [reduce, pulse]);

  const block = { backgroundColor: colors.surfaceMuted };
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your profile"
      importantForAccessibility="yes"
      style={[styles.root, { opacity: pulse }]}
    >
      {header ? (
        <View style={styles.header}>
          <View style={[styles.avatar, block]} />
          <View style={styles.lines}>
            <View style={[styles.line, styles.name, block]} />
            <View style={[styles.line, styles.email, block]} />
          </View>
        </View>
      ) : null}
      {goals ? (
        <View style={[styles.goals, card]}>
          <View style={[styles.line, styles.name, block]} />
          <View style={[styles.big, block]} />
          <View style={styles.tiles}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.tile, block]} />
            ))}
          </View>
          <View style={[styles.button, block]} />
        </View>
      ) : null}
      {body ? (
        <View style={[styles.bodyCard, card]}>
          <View style={[styles.line, styles.name, block]} />
          <View style={[styles.line, styles.email, block]} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  lines: { flex: 1, gap: space.sm },
  line: { height: 14, borderRadius: radius.sm },
  name: { width: '40%' },
  email: { width: '65%' },
  goals: { borderRadius: radius.sheet, padding: 20, gap: space.lg },
  big: { height: 48, width: '50%', borderRadius: radius.md },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, height: 84, borderRadius: 18 },
  button: { height: 48, borderRadius: radius.lg },
  bodyCard: { borderRadius: radius.sheet, padding: 20, gap: space.md, minHeight: 112 },
});
