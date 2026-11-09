import type { Dashboard } from '@/api/tracking';

/**
 * The dashboard as if the given entries were deleted: their nutrients leave the totals (never below 0) and
 * their calories go back to `remaining`. Returns the same object when nothing is removed.
 */
export function withoutEntries(d: Dashboard, ids: ReadonlySet<string>): Dashboard {
  if (ids.size === 0) return d;
  const removed = d.entries.filter((e) => ids.has(e.id));
  if (removed.length === 0) return d;
  const sum = (pick: (e: (typeof removed)[number]) => number) => removed.reduce((t, e) => t + pick(e), 0);
  const kcal = sum((e) => e.calories);
  const macro = (m: Dashboard['macros']['protein'], grams: number) => ({ ...m, consumed: Math.max(0, m.consumed - grams) });
  return {
    ...d,
    calories: {
      ...d.calories,
      consumed: Math.max(0, d.calories.consumed - kcal),
      remaining: d.calories.remaining + kcal,
    },
    macros: {
      protein: macro(d.macros.protein, sum((e) => e.protein)),
      carbs: macro(d.macros.carbs, sum((e) => e.carbs)),
      fat: macro(d.macros.fat, sum((e) => e.fat)),
    },
    entries: d.entries.filter((e) => !ids.has(e.id)),
  };
}
