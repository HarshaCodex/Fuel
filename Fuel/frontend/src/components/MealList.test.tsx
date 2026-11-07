import { render, screen } from '@testing-library/react-native';

import type { DashboardEntry } from '@/api/tracking';

import { MealList } from './MealList';

const entry = (id: string, foodName: string, mealLabel: string | null): DashboardEntry => ({
  id,
  foodName,
  source: 'USDA',
  mealLabel,
  calories: 100,
  protein: 1,
  carbs: 2,
  fat: 3,
  loggedAt: new Date(2026, 10, 3, 12, 30).toISOString(),
});

describe('MealList', () => {
  it('renders nothing when empty', async () => {
    await render(<MealList entries={[]} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('lists rows in group order under headers, with Other last', async () => {
    await render(
      <MealList
        entries={[
          entry('1', 'Rice', 'lunch'),
          entry('2', 'Mystery', null),
          entry('3', 'Eggs', 'breakfast'),
          entry('4', 'Beans', 'lunch'),
        ]}
      />,
    );
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual([
      'Breakfast',
      'Lunch',
      'Other',
    ]);
    const rows = screen.getAllByLabelText(/ calories, /).map((r) => r.props.accessibilityLabel.split(',')[0]);
    expect(rows).toEqual(['Eggs', 'Rice', 'Beans', 'Mystery']);
  });

  it('puts dividers between rows of a group only', async () => {
    await render(
      <MealList
        entries={[entry('1', 'Rice', 'lunch'), entry('2', 'Beans', 'lunch'), entry('3', 'Eggs', 'dinner')]}
      />,
    );
    expect(screen.getAllByTestId('meal-divider')).toHaveLength(1);
  });
});
