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
