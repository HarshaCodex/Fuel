import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DashboardEntry } from '@/api/tracking';

import { MealList } from './MealList';

// Gestures cannot run in Jest, so Swipeable is replaced by a pass-through.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { children: unknown }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: jest.fn() }));
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});

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

  it('renders action rows and passes the entry to the handlers when given', async () => {
    const onDeleteEntry = jest.fn();
    const onEditEntry = jest.fn();
    const e = { id: 'z', foodName: 'Rice', source: 'USDA', mealLabel: 'lunch', calories: 100, protein: 2, carbs: 20, fat: 0, loggedAt: '2026-11-09T12:00:00Z' } as DashboardEntry;
    await render(<MealList entries={[e]} onDeleteEntry={onDeleteEntry} onEditEntry={onEditEntry} />);
    const more = screen.getByRole('button', { name: 'More actions for Rice' });
    await fireEvent(more, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await fireEvent(more, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    expect(onDeleteEntry).toHaveBeenCalledWith(e);
    expect(onEditEntry).toHaveBeenCalledWith(e);
  });

  it('renders plain rows without handlers', async () => {
    const e = { id: 'z', foodName: 'Rice', source: 'USDA', mealLabel: 'lunch', calories: 100, protein: 2, carbs: 20, fat: 0, loggedAt: '2026-11-09T12:00:00Z' } as DashboardEntry;
    await render(<MealList entries={[e]} />);
    expect(screen.queryByRole('button', { name: 'More actions for Rice' })).toBeNull();
  });
});
