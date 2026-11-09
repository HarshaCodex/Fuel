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

/** Nutrients are linear in amount x quantity, so an edit scales them by the ratio of the products. */
export function editFactor(old: { amount: number; quantity: number }, next: { amount: number; quantity: number }): number {
  const before = old.amount * old.quantity;
  return before > 0 ? (next.amount * next.quantity) / before : 1;
}

/**
 * The dashboard as if one entry were edited: its nutrients are scaled by `factor`, the totals move by the difference
 * and its meal label changes when one is given. An estimate until the server's values replace it.
 */
export function withEditedEntry(d: Dashboard, id: string, edit: { factor: number; mealLabel?: string }): Dashboard {
  const old = d.entries.find((e) => e.id === id);
  if (!old) return d;
  const next = {
    ...old,
    calories: old.calories * edit.factor,
    protein: old.protein * edit.factor,
    carbs: old.carbs * edit.factor,
    fat: old.fat * edit.factor,
    mealLabel: edit.mealLabel ?? old.mealLabel,
  };
  const dKcal = next.calories - old.calories;
  const macro = (m: Dashboard['macros']['protein'], grams: number) => ({ ...m, consumed: Math.max(0, m.consumed + grams) });
  return {
    ...d,
    calories: { ...d.calories, consumed: Math.max(0, d.calories.consumed + dKcal), remaining: d.calories.remaining - dKcal },
    macros: {
      protein: macro(d.macros.protein, next.protein - old.protein),
      carbs: macro(d.macros.carbs, next.carbs - old.carbs),
      fat: macro(d.macros.fat, next.fat - old.fat),
    },
    entries: d.entries.map((e) => (e.id === id ? next : e)),
  };
}
