import { fireEvent, render, screen } from '@testing-library/react-native';

import type { HistoryDay } from '@/api/tracking';
import { MonthCalendar } from './MonthCalendar';

const day = (date: string, calories: number): HistoryDay => ({
  date, calories, calorieGoal: 2200, protein: 0, carbs: 0, fat: 0, fiber: 0, entryCount: 3,
});
const rows = [day('2025-11-13', 2420), day('2025-11-12', 1900), day('2025-11-15', 1420)];
const base = { year: 2025, month: 11, rows, todayIso: '2025-11-15', selected: '2025-11-15', onSelect: jest.fn() };

beforeEach(() => base.onSelect.mockClear());

describe('MonthCalendar', () => {
  it('labels each cell and marks the selected one', async () => {
    await render(<MonthCalendar {...base} />);
    expect(screen.getByLabelText('13 November, 2,420 calories, over goal')).toBeOnTheScreen();
    expect(screen.getByLabelText('12 November, 1,900 calories, within goal')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 November, no entries')).toBeOnTheScreen();
    expect(screen.getByLabelText('15 November, today, 1,420 calories').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('13 November, 2,420 calories, over goal').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('selects a tapped day, including an empty one', async () => {
    await render(<MonthCalendar {...base} />);
    await fireEvent.press(screen.getByLabelText('13 November, 2,420 calories, over goal'));
    await fireEvent.press(screen.getByLabelText('1 November, no entries'));
    expect(base.onSelect).toHaveBeenNthCalledWith(1, '2025-11-13');
    expect(base.onSelect).toHaveBeenNthCalledWith(2, '2025-11-01');
  });

  it('disables future days', async () => {
    await render(<MonthCalendar {...base} />);
    const future = screen.getByLabelText('20 November, not available yet');
    expect(future.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(future);
    expect(base.onSelect).not.toHaveBeenCalled();
  });

  it('shows the dot only on today', async () => {
    await render(<MonthCalendar {...base} />);
    expect(screen.getAllByTestId('today-dot')).toHaveLength(1);
  });

  it('shows skeleton rings and ignores taps while loading', async () => {
    await render(<MonthCalendar {...base} rows={[]} loading />);
    expect(screen.getAllByTestId('day-ring-skeleton').length).toBe(15);
    await fireEvent.press(screen.getByLabelText('1 November, no entries'));
    expect(base.onSelect).not.toHaveBeenCalled();
  });

  it('starts weeks on Monday and shows the legend', async () => {
    await render(<MonthCalendar {...base} />);
    expect(screen.getAllByText(/^[MTWFS]$/).map((n) => n.props.children).join('')).toBe('MTWTFSS');
    expect(screen.getByText('Within goal')).toBeOnTheScreen();
    expect(screen.getByText('Over goal')).toBeOnTheScreen();
    expect(screen.getByText('No logs')).toBeOnTheScreen();
  });
});
