import type { FoodSource } from '@/api/tracking';

export type MacroName = 'Protein' | 'Carbs' | 'Fat';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** One decimal at most; ".0" is dropped. */
export function formatGrams(n: number): string {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export type RingModel = {
  /** Arc length as a share of the circle, 0 to 1, from the raw values. */
  fraction: number;
  over: boolean;
  centre: string;
  caption: string;
  eaten: string;
  label: string;
};

export function ringModel({ consumed, goal }: { consumed: number; goal: number }): RingModel {
  const overBy = Math.round(consumed - goal);
  const over = overBy > 0;
  const fraction = over ? 1 : goal > 0 ? Math.min(Math.max(consumed / goal, 0), 1) : 0;
  const eaten = `${formatKcal(consumed)} of ${formatKcal(goal)} eaten`;
  const centre = over ? formatKcal(overBy) : formatKcal(Math.max(goal - consumed, 0));
  return {
    fraction,
    over,
    centre,
    caption: over ? 'kcal over' : 'kcal left',
    eaten,
    label: `${centre} calories ${over ? 'over' : 'remaining'}. ${eaten}.`,
  };
}

export type MacroModel = {
  name: MacroName;
  value: string;
  goal: string;
  fraction: number;
  over: boolean;
  label: string;
};

export function macroModel(name: MacroName, { consumed, goal }: { consumed: number; goal: number }): MacroModel {
  const value = formatGrams(consumed);
  const goalText = formatGrams(goal);
  return {
    name,
    value,
    goal: goalText,
    fraction: goal > 0 ? Math.min(Math.max(consumed / goal, 0), 1) : 0,
    over: goal > 0 && consumed > goal,
    label: `${name}, ${value} of ${goalText} grams`,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Calendar arithmetic in UTC so DST never skips or repeats a date. */
export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ISO dates compare correctly as strings. */
export const isFutureDate = (iso: string, todayIso: string): boolean => iso > todayIso;

export function dateTitle(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Today';
  if (iso === addDays(todayIso, -1)) return 'Yesterday';
  const d = parse(iso);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Local time as "12:30 PM". Manual on purpose: newer ICU inserts U+202F before AM/PM. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export const macroLine = (protein: number, carbs: number, fat: number): string =>
  `P ${formatGrams(protein)} · C ${formatGrams(carbs)} · F ${formatGrams(fat)}`;

const SOURCE_LABELS: Record<FoodSource, string> = {
  USDA: 'USDA Verified',
  OFF: 'Manufacturer Label',
  USER: 'You Entered',
};
export const sourceLabel = (source: FoodSource): string => SOURCE_LABELS[source];

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
const MEALS: readonly { key: MealKey; title: string }[] = [
  { key: 'breakfast', title: 'Breakfast' },
  { key: 'lunch', title: 'Lunch' },
  { key: 'dinner', title: 'Dinner' },
  { key: 'snack', title: 'Snack' },
  { key: 'other', title: 'Other' },
];
export type MealGroup<T> = { key: MealKey; title: string; entries: T[] };

/** Fixed meal order; empty groups are dropped and unknown labels go to Other. */
export function groupByMeal<T extends { mealLabel: string | null }>(entries: T[]): MealGroup<T>[] {
  const groups: MealGroup<T>[] = MEALS.map((m) => ({ ...m, entries: [] }));
  const other = groups[groups.length - 1];
  for (const e of entries) {
    const label = (e.mealLabel ?? '').trim().toLowerCase();
    (groups.find((g) => g.key === label) ?? other).entries.push(e);
  }
  return groups.filter((g) => g.entries.length > 0);
}

/** "WEDNESDAY, 11 NOVEMBER" for the small label above the Today title. */
export function longDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12)
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '')
    .toUpperCase()
    .replace(/^(\S+) /, '$1, ');
}
