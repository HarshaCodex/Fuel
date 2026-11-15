import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { space, useTheme } from '@/theme';

type Props = { height?: number };

/** Gradient from transparent to solid screen background (solid from 28%, as in the mockup), so scrolled content fades out above the pinned Log button. */
export function LogFade({ height = space.xxxl }: Props) {
  const { colors } = useTheme();
  return (
    <Svg testID="log-fade" pointerEvents="none" style={[styles.fade, { height, top: -height }]} width="100%" height={height}>
      <Defs>
        <LinearGradient id="logFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
          <Stop offset="0.28" stopColor={colors.bg} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#logFade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({ fade: { position: 'absolute', left: 0, right: 0 } });
