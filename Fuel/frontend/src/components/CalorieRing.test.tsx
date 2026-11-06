import { render, screen } from '@testing-library/react-native';
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
