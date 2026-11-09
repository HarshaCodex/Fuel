import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Food } from '@/api/food';

import { FoodRow } from './FoodRow';

const FOOD: Food = {
  id: 'f1',
  name: 'Chicken breast',
  brand: 'Farm Co',
  source: 'USDA',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
};

describe('FoodRow', () => {
  it('shows name, brand and serving, badge and kcal', async () => {
    await render(<FoodRow food={FOOD} onPress={jest.fn()} />);
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.getByText('Farm Co, 100 g')).toBeTruthy();
    expect(screen.getByText('USDA Verified')).toBeTruthy();
    expect(screen.getByText('165')).toBeTruthy();
  });

  it('has a full accessibility label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<FoodRow food={FOOD} onPress={onPress} />);
    const row = screen.getByLabelText('Chicken breast, Farm Co, 100 g, 165 calories, USDA Verified');
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('copes with a null brand and a non-gram unit', async () => {
    await render(<FoodRow food={{ ...FOOD, brand: null, servingSize: 1, servingUnit: 'cup' }} onPress={jest.fn()} />);
    expect(screen.getByText('1 cup')).toBeTruthy();
    expect(screen.getByLabelText('Chicken breast, 1 cup, 165 calories, USDA Verified')).toBeTruthy();
  });
});
