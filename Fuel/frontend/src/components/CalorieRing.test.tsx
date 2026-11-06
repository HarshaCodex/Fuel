import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, processColor } from 'react-native';

import { CalorieRing } from './CalorieRing';
import { lightColors } from '@/theme';

const arcStroke = () => screen.getByTestId('ring-arc').props.stroke;
const asNative = (c: string) => ({ payload: processColor(c), type: 0 });

beforeEach(() => {
  // Reduce Motion on: the fill jumps to its value, so tests need no animation timers.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('CalorieRing', () => {
  it('shows remaining, caption and eaten text with one accessible label', async () => {
    await render(<CalorieRing consumed={1450} goal={2200} />);
    expect(screen.getByText('750')).toBeTruthy();
    expect(screen.getByText('kcal left')).toBeTruthy();
    expect(screen.getByText('1,450 of 2,200 eaten')).toBeTruthy();
    expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
  });

  it('shows full remaining on an empty day', async () => {
    await render(<CalorieRing consumed={0} goal={2200} />);
    expect(screen.getByText('2,200')).toBeTruthy();
    expect(screen.getByText('0 of 2,200 eaten')).toBeTruthy();
  });

  it('uses the accent when exactly at goal', async () => {
    await render(<CalorieRing consumed={2200} goal={2200} />);
    expect(screen.getByText('kcal left')).toBeTruthy();
    expect(arcStroke()).toEqual(asNative(lightColors.accent));
  });

  it('shows the overage in caution when over goal', async () => {
    await render(<CalorieRing consumed={2520} goal={2200} />);
    expect(screen.getByText('320')).toBeTruthy();
    expect(screen.getByText('kcal over')).toBeTruthy();
    expect(screen.getByLabelText('320 calories over. 2,520 of 2,200 eaten.')).toBeTruthy();
    expect(arcStroke()).toEqual(asNative(lightColors.caution));
  });

  it('shows skeletons and no numbers while loading', async () => {
    await render(<CalorieRing consumed={0} goal={0} loading />);
    expect(screen.getByTestId('ring-skeleton')).toBeTruthy();
    expect(screen.queryByText('kcal left')).toBeNull();
    expect(screen.getByLabelText('Loading calories')).toBeTruthy();
  });
});

const C = 2 * Math.PI * ((200 - 14) / 2);
const arc = () => screen.getByTestId('ring-arc').props;
// The renderer reports a dashoffset of 0 as null.
const offsetOf = () => (arc().strokeDashoffset as number | null) ?? 0;

describe('CalorieRing arc', () => {
  beforeEach(() => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true));

  it.each([
    ['empty day', 0, 2200, false, C, 0],
    ['loading', 500, 2200, true, C, 0],
    ['exactly at goal', 2200, 2200, false, 0, 1],
    ['over goal', 2520, 2200, false, 0, 1],
    ['normal day', 1450, 2200, false, C * (1 - 1450 / 2200), 1],
  ])('draws the right arc for %s', async (_n, consumed, goal, loading, offset, opacity) => {
    await render(<CalorieRing consumed={consumed} goal={goal} loading={loading} />);
    expect(offsetOf()).toBeCloseTo(offset, 3);
    expect(arc().strokeOpacity).toBe(opacity);
  });

  it('animates to the target when Reduce Motion is off', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(<CalorieRing consumed={2200} goal={2200} />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(offsetOf()).toBeCloseTo(0, 3);
    jest.useRealTimers();
  });
});
