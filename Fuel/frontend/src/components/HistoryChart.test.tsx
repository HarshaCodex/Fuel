import { render, screen } from '@testing-library/react-native';

import type { ChartBar } from '@/lib/historyView';
import { lightColors } from '@/theme/colors';

import { HistoryChart } from './HistoryChart';

const bar = (date: string, calories: number, extra: Partial<ChartBar> = {}): ChartBar => ({
  date,
  endDate: date,
  calories,
  isToday: false,
  weekly: false,
  ...extra,
});

describe('HistoryChart', () => {
  it('labels each bar with day, calories and goal', async () => {
    await render(<HistoryChart bars={[bar('2026-11-09', 1450)]} goal={2200} />);
    expect(screen.getByLabelText('Mon 9 Nov, 1,450 calories, goal 2,200')).toBeOnTheScreen();
  });

  it('says which bar is today', async () => {
    await render(<HistoryChart bars={[bar('2026-11-10', 900, { isToday: true })]} goal={2200} />);
    expect(screen.getByLabelText('Tue 10 Nov, 900 calories, goal 2,200, today')).toBeOnTheScreen();
  });

  it('labels weekly bars as averages', async () => {
    const weekly = bar('2026-11-03', 1800, { endDate: '2026-11-09', weekly: true });
    await render(<HistoryChart bars={[weekly]} goal={2200} />);
    expect(screen.getByLabelText('Week of Tue 3 Nov, average 1,800 calories, goal 2,200')).toBeOnTheScreen();
  });

  it('highlights today and scales bars against the goal', async () => {
    const bars = [bar('2026-11-09', 1100), bar('2026-11-10', 2200, { isToday: true })];
    await render(<HistoryChart bars={bars} goal={2200} />);
    expect(screen.getAllByTestId('bar-today')).toHaveLength(1);
    expect(screen.getByTestId('bar-today')).toHaveStyle({ height: 120 });
    expect(screen.getByTestId('bar')).toHaveStyle({ height: 60 });
    expect(screen.getByTestId('bar-today')).toHaveStyle({ backgroundColor: lightColors.accent });
    expect(screen.getByTestId('bar')).toHaveStyle({ backgroundColor: lightColors.accent });
    expect(screen.getByTestId('bar')).not.toHaveStyle({ opacity: 0.55 });
    expect(screen.getAllByTestId('today-cap')).toHaveLength(1);
    expect(screen.getByTestId('today-cap')).toHaveStyle({ height: 2, backgroundColor: lightColors.text });
    expect(screen.getByTestId('goal-line')).toHaveStyle({ bottom: 120 });
  });

  it('shows axis labels, today and the goal value', async () => {
    const bars = [bar('2026-11-09', 1100), bar('2026-11-10', 2200, { isToday: true })];
    await render(<HistoryChart bars={bars} goal={2200} />);
    expect(screen.getByText('9 Nov', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Today', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Goal 2,200')).toBeOnTheScreen();
  });

  it('grows the scale when a day is over goal', async () => {
    await render(<HistoryChart bars={[bar('2026-11-09', 4400)]} goal={2200} />);
    expect(screen.getByTestId('bar')).toHaveStyle({ height: 120 });
    expect(screen.getByTestId('goal-line')).toHaveStyle({ bottom: 60 });
  });

  it('shows zero-calorie days as empty and handles a zero goal', async () => {
    await render(<HistoryChart bars={[bar('2026-11-09', 0), bar('2026-11-10', 500)]} goal={0} />);
    expect(screen.queryByTestId('goal-line')).toBeNull();
    expect(screen.getAllByTestId('bar')[0]).toHaveStyle({ height: 0 });
    expect(screen.getByLabelText('Mon 9 Nov, 0 calories')).toBeOnTheScreen();
  });

  it('uses tighter gaps for 30 bars than for 7', async () => {
    const thirty = Array.from({ length: 30 }, (_, i) => bar(`2026-10-${String(i + 1).padStart(2, '0')}`, 100));
    await render(<HistoryChart bars={thirty} goal={2000} />);
    expect(screen.getAllByTestId('bar')).toHaveLength(30);
    expect(screen.getByTestId('history-plot')).toHaveStyle({ gap: 2 });
  });
});
