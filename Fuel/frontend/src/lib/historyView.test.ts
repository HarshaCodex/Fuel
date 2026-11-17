import type { HistoryDay } from '@/api/tracking';
import {
  cellA11yLabel, dayState, defaultSelection, entriesLabel, isWithinGoal, leftOrOverLabel,
  longDateLabel, monthGrid, monthRange, shiftMonth, summary,
} from './historyView';

const day = (date: string, calories: number, calorieGoal = 2000): HistoryDay => ({
  date, calories, calorieGoal, protein: 0, carbs: 0, fat: 0, fiber: 0, entryCount: 1,
});

describe('labels', () => {
  it('pluralises entries', () => {
    expect(entriesLabel(1)).toBe('1 entry');
    expect(entriesLabel(0)).toBe('0 entries');
    expect(entriesLabel(4)).toBe('4 entries');
  });
});

describe('summary', () => {
  it('is zero for no data', () => {
    expect(summary([])).toEqual({ averageCalories: 0, daysLogged: 0, daysOnGoal: 0 });
  });

  it('averages per logged day and counts days within 105% of goal', () => {
    const s = summary([day('a', 2000), day('b', 2200.4), day('c', 1000), day('d', 100, 0)]);
    expect(s).toEqual({ averageCalories: 1325, daysLogged: 4, daysOnGoal: 2 });
  });

  it('treats goal 0 without dividing', () => {
    expect(summary([day('a', 0, 0)]).daysOnGoal).toBe(1);
  });
});

describe('isWithinGoal', () => {
  it('allows exactly 105% and rejects just above', () => {
    expect(isWithinGoal(2100, 2000)).toBe(true);
    expect(isWithinGoal(2102, 2000)).toBe(false);
  });
  it('counts a day on 105% in summary', () => {
    expect(summary([day('a', 2100), day('b', 2102)]).daysOnGoal).toBe(1);
  });
});

describe('monthRange', () => {
  it('spans a whole past month, including leap February', () => {
    expect(monthRange(2024, 2, '2026-11-15')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange(2025, 2, '2026-11-15')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(monthRange(2025, 12, '2026-11-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(monthRange(2026, 1, '2026-11-15')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(monthRange(2026, 12, '2026-12-05')).toEqual({ from: '2026-12-01', to: '2026-12-05' });
  });
  it('stops at today in the current month', () => {
    expect(monthRange(2026, 11, '2026-11-15')).toEqual({ from: '2026-11-01', to: '2026-11-15' });
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries both ways', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1, '2026-11-15')).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2025, month: 12 }, 1, '2026-11-15')).toEqual({ year: 2026, month: 1 });
  });
  it('never goes past the current month', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1, '2026-11-15')).toEqual({ year: 2026, month: 11 });
  });
});

describe('monthGrid', () => {
  it('starts weeks on Monday for a month starting on Sunday', () => {
    const g = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g[g.length - 1]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });
  it('has no leading nulls for a month starting on Monday', () => {
    expect(monthGrid(2025, 9)[0][0]).toBe('2025-09-01'); // 1 Sep 2025 is a Monday
  });
  it('uses 29 days in Feb 2024 and 28 in Feb 2025', () => {
    const count = (y: number) => monthGrid(y, 2).flat().filter(Boolean).length;
    expect(count(2024)).toBe(29);
    expect(count(2025)).toBe(28);
    expect(monthGrid(2025, 2).every((w) => w.length === 7)).toBe(true);
  });
});

describe('dayState', () => {
  const row = (calories: number, calorieGoal = 2000) => ({ calories, calorieGoal });
  it('is future after today', () => {
    expect(dayState('2026-11-16', undefined, '2026-11-15').state).toBe('future');
  });
  it('is empty without a row, for today and past days', () => {
    expect(dayState('2026-11-15', undefined, '2026-11-15').state).toBe('empty');
    expect(dayState('2026-11-10', undefined, '2026-11-15').state).toBe('empty');
  });
  it('is within or over with the fraction capped at 1', () => {
    expect(dayState('2026-11-10', row(1000), '2026-11-15')).toEqual({ state: 'within', fraction: 0.5 });
    expect(dayState('2026-11-10', row(2100), '2026-11-15')).toEqual({ state: 'within', fraction: 1 });
    expect(dayState('2026-11-10', row(3000), '2026-11-15')).toEqual({ state: 'over', fraction: 1 });
  });
  it('is todayInProgress for today at or under goal, over once past it', () => {
    expect(dayState('2026-11-15', row(1000), '2026-11-15').state).toBe('todayInProgress');
    expect(dayState('2026-11-15', row(2500), '2026-11-15').state).toBe('over');
  });
  it('treats a goal of 0 as an empty ring', () => {
    expect(dayState('2026-11-10', row(500, 0), '2026-11-15')).toEqual({ state: 'empty', fraction: 0 });
  });
});

describe('defaultSelection', () => {
  const rows = [day('2026-10-03', 1), day('2026-10-20', 1)];
  it('selects today in the current month', () => {
    expect(defaultSelection({ year: 2026, month: 11 }, [], '2026-11-15')).toBe('2026-11-15');
  });
  it('selects the last logged day of an earlier month', () => {
    expect(defaultSelection({ year: 2026, month: 10 }, rows, '2026-11-15')).toBe('2026-10-20');
  });
  it('falls back to the last day of an empty earlier month', () => {
    expect(defaultSelection({ year: 2026, month: 2 }, [], '2026-11-15')).toBe('2026-02-28');
  });
});

describe('labels', () => {
  it('formats the long date', () => {
    expect(longDateLabel('2025-11-14')).toBe('Friday, 14 November');
  });
  it('describes cells', () => {
    expect(cellA11yLabel('2026-11-13', day('2026-11-13', 2420, 2200), '2026-11-15')).toBe('13 November, 2,420 calories, over goal');
    expect(cellA11yLabel('2026-10-21', undefined, '2026-11-15')).toBe('21 October, no entries');
    expect(cellA11yLabel('2026-11-15', day('2026-11-15', 1420, 2200), '2026-11-15')).toBe('15 November, today, 1,420 calories');
    expect(cellA11yLabel('2026-11-15', undefined, '2026-11-15')).toBe('15 November, today, no entries');
  });
  it('says left or over', () => {
    expect(leftOrOverLabel(1420, 2200)).toBe('780 left');
    expect(leftOrOverLabel(2420, 2200)).toBe('220 over');
  });
});
