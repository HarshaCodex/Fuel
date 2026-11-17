import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HistoryDay } from '@/api/tracking';

import { SelectedDayCard } from './SelectedDayCard';

const row = (calories: number): HistoryDay => ({
  date: '2026-11-13', calories, calorieGoal: 2200, protein: 118, carbs: 280, fat: 92, fiber: 0, entryCount: 3,
});

describe('SelectedDayCard', () => {
  it('shows totals and opens the day on press', async () => {
    const onPress = jest.fn();
    await render(<SelectedDayCard date="2026-11-13" todayIso="2026-11-15" row={row(2420)} onPress={onPress} />);
    expect(screen.getByText('Friday, 13 November')).toBeTruthy();
    expect(screen.getByText('P 118 · C 280 · F 92 · 220 over')).toBeTruthy();
    expect(screen.getByText('3 entries ›')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith('2026-11-13');
  });

  it('titles today and shows what is left', async () => {
    await render(<SelectedDayCard date="2026-11-13" todayIso="2026-11-13" row={row(1420)} onPress={jest.fn()} />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('P 118 · C 280 · F 92 · 780 left')).toBeTruthy();
  });

  it('is plain and not pressable for an empty day', async () => {
    await render(<SelectedDayCard date="2026-10-21" todayIso="2026-11-15" row={undefined} onPress={jest.fn()} />);
    expect(screen.getByText('No entries')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
