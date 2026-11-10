import type { HistoryDay } from '@/api/tracking';
import { chartBars, dayLabel, entriesLabel, rangeFor, summary } from './historyView';

const day = (date: string, calories: number, calorieGoal = 2000): HistoryDay => ({
  date, calories, calorieGoal, protein: 0, carbs: 0, fat: 0, fiber: 0, entryCount: 1,
});
const TODAY = '2026-11-09';

describe('rangeFor', () => {
  it.each([[7, '2026-11-03'], [30, '2026-10-11'], [90, '2026-08-12']])('%i days spans exactly that many dates', (n, from) => {
    const r = rangeFor(n, TODAY);
    expect(r).toEqual({ days: n, from, to: TODAY });
  });

  it('clamps to 90 inclusive and at least 1', () => {
    expect(rangeFor(365, TODAY).from).toBe('2026-08-12');
    expect(rangeFor(0, TODAY)).toEqual({ days: 1, from: TODAY, to: TODAY });
  });

  it('crosses a year boundary', () => {
    expect(rangeFor(7, '2026-01-03').from).toBe('2025-12-28');
  });
});

describe('labels', () => {
  it('formats the day', () => expect(dayLabel('2026-11-09')).toBe('Mon 9 Nov'));
  it('pluralises entries', () => {
    expect(entriesLabel(1)).toBe('1 entry');
    expect(entriesLabel(0)).toBe('0 entries');
    expect(entriesLabel(4)).toBe('4 entries');
  });
});

describe('chartBars', () => {
  it('fills omitted days with 0, oldest first, and marks today', () => {
    const bars = chartBars([day('2026-11-09', 1450.4), day('2026-11-05', 1800)], rangeFor(7, TODAY), TODAY);
    expect(bars.map((b) => b.date)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09']);
    expect(bars.map((b) => b.calories)).toEqual([0, 0, 1800, 0, 0, 0, 1450]);
    expect(bars.filter((b) => b.isToday).map((b) => b.date)).toEqual([TODAY]);
    expect(bars.some((b) => b.weekly)).toBe(false);
  });

  it('gives an empty history 30 zero bars', () => {
    const bars = chartBars([], rangeFor(30, TODAY), TODAY);
    expect(bars).toHaveLength(30);
    expect(bars.every((b) => b.calories === 0)).toBe(true);
  });

  it('groups 90 days by week averaging only logged days, with a partial oldest week', () => {
    const range = rangeFor(90, TODAY);
    const bars = chartBars([day('2026-11-09', 1000), day('2026-11-04', 2000), day('2026-08-12', 1500)], range, TODAY);
    expect(bars).toHaveLength(13);
    expect(bars.every((b) => b.weekly)).toBe(true);
    const last = bars[bars.length - 1];
    expect([last.date, last.endDate, last.calories, last.isToday]).toEqual(['2026-11-03', '2026-11-09', 1500, true]);
    const first = bars[0];
    expect([first.date, first.endDate, first.calories]).toEqual(['2026-08-12', '2026-08-17', 1500]);
    expect(bars[1].calories).toBe(0);
    expect(bars.filter((b) => b.isToday)).toHaveLength(1);
  });
});

describe('summary', () => {
  it('is zero for no data', () => {
    expect(summary([])).toEqual({ averageCalories: 0, daysLogged: 0, daysOnGoal: 0 });
  });

  it('averages per logged day and counts at-or-under goal', () => {
    const s = summary([day('a', 2000), day('b', 2200.4), day('c', 1000), day('d', 100, 0)]);
    expect(s).toEqual({ averageCalories: 1325, daysLogged: 4, daysOnGoal: 2 });
  });

  it('treats goal 0 without dividing', () => {
    expect(summary([day('a', 0, 0)]).daysOnGoal).toBe(1);
  });
});
