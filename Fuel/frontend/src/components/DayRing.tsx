import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { DayState } from '@/lib/historyView';
import { numeric, useTheme } from '@/theme';

type Props = { day: number; state: DayState | 'skeleton'; fraction: number };

const SIZE = 38;
const STROKE = 3.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** One calendar day: a small ring filled to the share of the calorie goal, with the day number inside. */
export function DayRing({ day, state, fraction }: Props) {
  const { colors } = useTheme();
  const arc = state === 'within' ? colors.accent : state === 'over' ? colors.protein : state === 'todayInProgress' ? colors.accentTint : null;
  const shown = arc ? Math.min(Math.max(fraction, 0), 1) : 0;
  return (
    <View style={styles.root} testID={state === 'skeleton' ? 'day-ring-skeleton' : undefined}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.track} strokeWidth={STROKE} fill="none" />
        {arc && shown > 0 ? (
          <Circle
            testID="day-ring-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={arc}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C * shown} ${C}`}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        ) : null}
      </Svg>
      <Text
        style={[styles.day, numeric, { color: state === 'future' || state === 'skeleton' ? colors.textTertiary : colors.text }]}
        maxFontSizeMultiplier={1.3}
      >
        {day}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  day: { fontSize: 13, lineHeight: 16, fontFamily: 'Manrope_700Bold' },
});
