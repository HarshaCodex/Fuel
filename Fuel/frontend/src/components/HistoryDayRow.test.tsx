import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HistoryDay } from '@/api/tracking';

import { HistoryDayRow } from './HistoryDayRow';

const day = (extra: Partial<HistoryDay> = {}): HistoryDay => ({
  date: '2026-11-09',
  calories: 1450.4,
  calorieGoal: 2200,
  protein: 120,
  carbs: 140,
  fat: 45.25,
  fiber: 20,
  entryCount: 4,
  ...extra,
});

describe('HistoryDayRow', () => {
  it('shows date, rounded calories, macros and entry count', async () => {
    await render(<HistoryDayRow day={day()} onPress={jest.fn()} />);
    expect(screen.getByText('Mon 9 Nov')).toBeOnTheScreen();
    expect(screen.getByText('1,450 kcal')).toBeOnTheScreen();
    expect(screen.getByText('P 120 - C 140 - F 45.3')).toBeOnTheScreen();
    expect(screen.getByText('4 entries')).toBeOnTheScreen();
  });

  it('uses the singular for one entry', async () => {
    await render(<HistoryDayRow day={day({ entryCount: 1 })} onPress={jest.fn()} />);
    expect(screen.getByText('1 entry')).toBeOnTheScreen();
  });

  it('opens the day with its date when pressed', async () => {
    const onPress = jest.fn();
    await render(<HistoryDayRow day={day()} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Open Mon 9 Nov'));
    expect(onPress).toHaveBeenCalledWith('2026-11-09');
  });

  it('fills the bar in proportion to the goal', async () => {
    await render(<HistoryDayRow day={day({ calories: 1100 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('day-fill')).toHaveStyle({ width: '50%' });
  });

  it('caps the bar at 100% when over goal', async () => {
    await render(<HistoryDayRow day={day({ calories: 3000 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('day-fill')).toHaveStyle({ width: '100%' });
  });

  it('is full when exactly on goal', async () => {
    await render(<HistoryDayRow day={day({ calories: 2200 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('day-fill')).toHaveStyle({ width: '100%' });
  });

  it('does not divide by a zero goal', async () => {
    await render(<HistoryDayRow day={day({ calorieGoal: 0 })} onPress={jest.fn()} />);
    expect(screen.getByTestId('day-fill')).toHaveStyle({ width: '0%' });
  });
});
