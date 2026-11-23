import type { Dashboard, DashboardEntry } from '@/api/tracking';

import { editFactor, withEditedEntry, withoutEntries } from './dashboardTotals';

const entry = (id: string, calories: number, protein: number, carbs: number, fat: number): DashboardEntry => ({
  id, foodName: id, source: 'USDA', mealLabel: 'lunch', calories, protein, carbs, fat, loggedAt: '2026-11-09T08:00:00Z',
});
const m = (consumed: number) => ({ consumed, goal: 100, unit: 'g' as const });
const day = (): Dashboard => ({
  date: '2026-11-09',
  calories: { consumed: 500, goal: 400, remaining: -100 },
  macros: { protein: m(50), carbs: m(60), fat: m(20) },
  entries: [entry('a', 300, 30, 40, 10), entry('b', 200, 20, 20, 10)],
  streak: { current: 1, longest: 2 },
});

describe('withoutEntries', () => {
  it('returns the same object when nothing is removed', () => {
    const d = day();
    expect(withoutEntries(d, new Set())).toBe(d);
    expect(withoutEntries(d, new Set(['zzz']))).toBe(d);
  });

  it('subtracts the entry from every total and gives calories back to remaining', () => {
    const r = withoutEntries(day(), new Set(['a']));
    expect(r.calories).toEqual({ consumed: 200, goal: 400, remaining: 200 });
    expect(r.macros.protein.consumed).toBe(20);
    expect(r.macros.carbs.consumed).toBe(20);
    expect(r.macros.fat.consumed).toBe(10);
    expect(r.entries.map((e) => e.id)).toEqual(['b']);
  });

  it('removes several entries and zeroes the totals when the last one goes', () => {
    const r = withoutEntries(day(), new Set(['a', 'b']));
    expect(r.entries).toEqual([]);
    expect(r.calories.consumed).toBe(0);
    expect(r.calories.remaining).toBe(400);
  });

  it('clamps consumed at 0 when the totals are smaller than the entry', () => {
    const d = { ...day(), calories: { consumed: 100, goal: 400, remaining: 300 } };
    expect(withoutEntries(d, new Set(['a'])).calories.consumed).toBe(0);
  });

  it('does not mutate the input', () => {
    const d = day();
    withoutEntries(d, new Set(['a']));
    expect(d.entries).toHaveLength(2);
    expect(d.calories.consumed).toBe(500);
  });
});

describe('editFactor', () => {
  it('is the ratio of amount x quantity', () => {
    expect(editFactor({ amount: 100, quantity: 1 }, { amount: 100, quantity: 2 })).toBe(2);
    expect(editFactor({ amount: 100, quantity: 2 }, { amount: 50, quantity: 2 })).toBe(0.5);
  });

  it('is 1 when the old product is 0', () => {
    expect(editFactor({ amount: 0, quantity: 1 }, { amount: 50, quantity: 1 })).toBe(1);
  });
});

describe('withEditedEntry', () => {
  it('scales the entry and moves the totals by the difference', () => {
    const r = withEditedEntry(day(), 'a', { factor: 2 });
    expect(r.entries[0]).toMatchObject({ calories: 600, protein: 60, carbs: 80, fat: 20 });
    expect(r.entries[1].calories).toBe(200);
    expect(r.calories).toEqual({ consumed: 800, goal: 400, remaining: -400 });
    expect(r.macros.protein.consumed).toBe(80);
    expect(r.macros.carbs.consumed).toBe(100);
    expect(r.macros.fat.consumed).toBe(30);
  });

  it('gives calories back to remaining when the entry shrinks', () => {
    const r = withEditedEntry(day(), 'a', { factor: 0.5 });
    expect(r.calories).toEqual({ consumed: 350, goal: 400, remaining: 50 });
  });

  it('changes only the meal label, not the totals, when the factor is 1', () => {
    const d = day();
    const r = withEditedEntry(d, 'a', { factor: 1, mealLabel: 'dinner' });
    expect(r.entries[0].mealLabel).toBe('dinner');
    expect(r.calories).toEqual(d.calories);
    expect(r.macros).toEqual(d.macros);
  });

  it('keeps the label when none is given, returns the same object for an unknown id and does not mutate', () => {
    const d = day();
    expect(withEditedEntry(d, 'a', { factor: 2 }).entries[0].mealLabel).toBe('lunch');
    expect(withEditedEntry(d, 'zzz', { factor: 2 })).toBe(d);
    expect(d.entries[0].calories).toBe(300);
  });
});
