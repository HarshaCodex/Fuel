import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ringModel } from '@/lib/dashboardView';
import { motion, numeric, space, type, useTheme } from '@/theme';

type Props = { consumed: number; goal: number; loading?: boolean };

const SIZE = 200;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Calories remaining as a ring: starts at 12 o'clock, fills clockwise. */
export function CalorieRing({ consumed, goal, loading }: Props) {
  const { colors } = useTheme();
  const m = ringModel({ consumed, goal });
  const target = loading ? 0 : m.fraction;
  const [progress] = useState(() => new Animated.Value(target));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(target);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: target,
      duration: motion.slow,
      easing: Easing.bezier(...motion.easing),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reduceMotion, progress]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });
  const arc = m.over ? colors.caution : colors.accent;

  return (
    <View accessible accessibilityLabel={loading ? 'Loading calories' : m.label} style={styles.root}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.ringTrack} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            testID="ring-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={arc}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={C}
            strokeDashoffset={offset}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.centre}>
          {loading ? (
            <View testID="ring-skeleton" style={styles.skeletons}>
              <View style={[styles.bone, { width: 96, height: 40, backgroundColor: colors.barTrack }]} />
              <View style={[styles.bone, { width: 64, height: 14, backgroundColor: colors.barTrack }]} />
            </View>
          ) : (
            <>
              <Text
                style={[type.display, numeric, { color: m.over ? colors.caution : colors.text }]}
                maxFontSizeMultiplier={1.3}
              >
                {m.centre}
              </Text>
              <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {m.caption}
              </Text>
            </>
          )}
        </View>
      </View>
      {loading ? (
        <View style={[styles.bone, styles.eaten, { width: 140, height: 14, backgroundColor: colors.barTrack }]} />
      ) : (
        <Text
          style={[type.caption, numeric, styles.eaten, { color: colors.textSecondary }]}
          maxFontSizeMultiplier={1.3}
        >
          {m.eaten}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', alignItems: 'center' },
  ring: { width: SIZE, height: SIZE },
  svg: { position: 'absolute' },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  eaten: { marginTop: space.md, textAlign: 'center' },
  skeletons: { alignItems: 'center', gap: space.sm },
  bone: { borderRadius: 8 },
});
