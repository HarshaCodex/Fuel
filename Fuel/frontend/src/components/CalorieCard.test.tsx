import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { lightColors, motion } from '@/theme';

import { CalorieCard } from './CalorieCard';
import { useKeyboardHeight } from './KeyboardAvoider';

jest.mock('./KeyboardAvoider', () => ({ useKeyboardHeight: jest.fn() }));

const kb = useKeyboardHeight as jest.Mock;
beforeEach(() => {
  kb.mockReturnValue(0);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

const chicken = { calories: 289, protein: 54.3, carbs: 0, fat: 6.3 };
const flexOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).flex;

describe('CalorieCard', () => {
  it('shows kcal, amount line, grams and one accessible label', async () => {
    await render(<CalorieCard macros={chicken} amountLabel="175 g" />);
    expect(screen.getByText('289')).toBeTruthy();
    expect(screen.getByText('kcal in 175 g')).toBeTruthy();
    expect(screen.getByText('54.3 g')).toBeTruthy();
    expect(screen.getByText('0 g')).toBeTruthy();
    expect(screen.getByLabelText('289 calories, protein 54.3 grams, carbs 0 grams, fat 6.3 grams')).toBeTruthy();
  });

  it('leaves out the segment of a 0g nutrient and weights fat by 9 kcal per gram', async () => {
    await render(<CalorieCard macros={{ calories: 100, protein: 10, carbs: 0, fat: 10 }} amountLabel="100 g" />);
    expect(screen.queryByTestId('split-carbs')).toBeNull();
    expect(flexOf('split-protein')).toBeCloseTo(40);
    expect(flexOf('split-fat')).toBeCloseTo(90);
    expect(StyleSheet.flatten(screen.getByTestId('split-fat').props.style).backgroundColor).toBe(lightColors.fat);
  });

  it('shows an empty track when everything is zero', async () => {
    await render(<CalorieCard macros={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} amountLabel="100 g" />);
    expect(screen.queryByTestId('split-protein')).toBeNull();
    expect(screen.queryByTestId('split-carbs')).toBeNull();
    expect(screen.queryByTestId('split-fat')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('calorie-split').props.style).backgroundColor).toBe(lightColors.barTrack);
  });

  it('uses the compact number size while the keyboard is up', async () => {
    const size = () => StyleSheet.flatten(screen.getByTestId('calorie-card-kcal').props.style).fontSize;
    const { rerender } = await render(<CalorieCard macros={chicken} amountLabel="175 g" />);
    expect(size()).toBe(56);
    kb.mockReturnValue(300);
    await rerender(<CalorieCard macros={chicken} amountLabel="175 g" />);
    expect(size()).toBe(40);
  });

  it('updates the number and label at once with Reduce Motion', async () => {
    const { rerender } = await render(<CalorieCard macros={chicken} amountLabel="175 g" />);
    await rerender(<CalorieCard macros={{ calories: 100, protein: 20, carbs: 5, fat: 1 }} amountLabel="50 g" />);
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByLabelText('100 calories, protein 20 grams, carbs 5 grams, fat 1 grams')).toBeTruthy();
  });
});

describe('CalorieCard animation', () => {
  it('counts to the new value over motion.fast when Reduce Motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    let now = 1000;
    let queued: (() => void)[] = [];
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((cb: () => void) => {
      queued.push(cb);
      return 1;
    }) as never);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((() => {
      queued = [];
    }) as never);
    const advance = (ms: number) =>
      act(() => {
        now += ms;
        const cbs = queued;
        queued = [];
        cbs.forEach((cb) => cb());
      });
    const shown = () => Number(String(screen.getByTestId('calorie-card-kcal').props.children).replace(',', ''));
    const from = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const { rerender } = await render(<CalorieCard macros={from} amountLabel="0 g" />);
    await rerender(<CalorieCard macros={{ calories: 1000, protein: 10, carbs: 10, fat: 10 }} amountLabel="100 g" />);
    await advance(motion.fast / 2);
    expect(shown()).toBeGreaterThan(0);
    expect(shown()).toBeLessThan(1000);
    await advance(motion.fast);
    expect(shown()).toBe(1000);
  });
});
