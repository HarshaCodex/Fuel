import { useState } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from '@/lib/useReduceMotion';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> };

/** A pressable that springs to 0.98 while held. No motion when Reduce Motion is on. */
export function PressableScale({ style, contentStyle, onPressIn, onPressOut, children, ...rest }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduce = useReduceMotion();
  const to = (v: number) => {
    if (reduce) return;
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...rest}
        style={contentStyle}
        onPressIn={(e) => {
          to(0.98);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          to(1);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
