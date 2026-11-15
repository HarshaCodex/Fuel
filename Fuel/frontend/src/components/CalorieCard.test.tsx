import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { lightColors } from '@/theme';

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
