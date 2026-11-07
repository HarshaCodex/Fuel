import { render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { MealRow } from './MealRow';

afterEach(() => jest.restoreAllMocks());

const props = {
  name: 'Chicken breast',
  source: 'USDA',
  loggedAt: new Date(2026, 10, 3, 12, 30).toISOString(),
  calories: 248,
  protein: 46,
  carbs: 0,
  fat: 5,
  mealLabel: 'lunch',
} as const;

describe('MealRow', () => {
  it('is one element with a spoken label and shows every part', async () => {
    await render(<MealRow {...props} />);
    expect(
      screen.getByLabelText('Chicken breast, lunch, 248 calories, USDA Verified, 12:30 PM'),
    ).toBeTruthy();
    expect(screen.getByText('P 46 - C 0 - F 5')).toBeTruthy();
    expect(screen.getByText('USDA Verified')).toBeTruthy();
    expect(screen.getByText('12:30 PM')).toBeTruthy();
    expect(screen.getByText('248')).toBeTruthy();
    expect(screen.getByText('kcal')).toBeTruthy();
  });

  it('drops the meal from the label when there is none', async () => {
    await render(<MealRow {...props} mealLabel={null} />);
    expect(screen.getByLabelText('Chicken breast, 248 calories, USDA Verified, 12:30 PM')).toBeTruthy();
  });

  it('shows zero calories', async () => {
    await render(<MealRow {...props} calories={0} />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByLabelText(/, 0 calories,/)).toBeTruthy();
  });

  it('has no press target', async () => {
    await render(<MealRow {...props} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('truncates a long name to one line at normal text size', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    await render(<MealRow {...props} name={'Slow cooked chicken breast with herbs '.repeat(4)} />);
    expect(screen.getByText(/^Slow cooked/).props.numberOfLines).toBe(1);
  });

  it('allows two name lines at large text sizes', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.6);
    await render(<MealRow {...props} />);
    expect(screen.getByText('Chicken breast').props.numberOfLines).toBe(2);
  });
});
