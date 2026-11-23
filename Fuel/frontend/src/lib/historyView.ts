import type { HistoryDay } from '@/api/tracking';
import { formatKcal } from './dashboardView';

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const entriesLabel = (n: number): string => (n === 1 ? '1 entry' : `${n} entries`);

export type HistorySummaryModel = { averageCalories: number; daysLogged: number; daysOnGoal: number };

/** The one goal rule: a day is within goal up to 105% of the calorie goal. */
export const isWithinGoal = (calories: number, goal: number): boolean => calories <= goal * 1.05;

/** Average calories per logged day and how many logged days were within goal. */
export function summary(days: HistoryDay[]): HistorySummaryModel {
  const total = days.reduce((a, d) => a + d.calories, 0);
  return {
    averageCalories: days.length ? Math.round(total / days.length) : 0,
    daysLogged: days.length,
    daysOnGoal: days.filter((d) => isWithinGoal(d.calories, d.calorieGoal)).length,
  };
}

/** A calendar month; `month` is 1 to 12. */
export type YearMonth = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const currentMonth = (todayIso: string): YearMonth => {
  const [year, month] = todayIso.split('-').map(Number);
  return { year, month };
};
const monthIndex = (ym: YearMonth) => ym.year * 12 + ym.month;

/** First day of the month to its last day, or to today for the current month. */
export function monthRange(year: number, month: number, todayIso: string): { from: string; to: string } {
  const last = `${year}-${pad(month)}-${pad(daysIn(year, month))}`;
  return { from: `${year}-${pad(month)}-01`, to: last > todayIso ? todayIso : last };
}

/** Previous or next month, never past the current one. */
export function shiftMonth(ym: YearMonth, delta: number, todayIso: string): YearMonth {
  const idx = monthIndex(ym) - 1 + delta;
  const next = { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  return monthIndex(next) > monthIndex(currentMonth(todayIso)) ? ym : next;
}

/** Weeks starting Monday; days outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array<null>(lead).fill(null);
  for (let d = 1; d <= daysIn(year, month); d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export type DayState = 'future' | 'empty' | 'within' | 'over' | 'todayInProgress';

/** How a calendar cell looks; `fraction` is calories over goal, capped at 1. */
export function dayState(
  date: string,
  row: Pick<HistoryDay, 'calories' | 'calorieGoal'> | undefined,
  todayIso: string,
): { state: DayState; fraction: number } {
  if (date > todayIso) return { state: 'future', fraction: 0 };
  if (!row || row.calorieGoal <= 0) return { state: 'empty', fraction: 0 };
  const fraction = Math.min(Math.max(row.calories / row.calorieGoal, 0), 1);
  if (!isWithinGoal(row.calories, row.calorieGoal)) return { state: 'over', fraction };
  return { state: date === todayIso ? 'todayInProgress' : 'within', fraction };
}

/** Today for the current month; otherwise the last logged day, else the month's last day. */
export function defaultSelection(ym: YearMonth, rows: Pick<HistoryDay, 'date'>[], todayIso: string): string {
  const cur = currentMonth(todayIso);
  if (ym.year === cur.year && ym.month === cur.month) return todayIso;
  const dates = rows.map((r) => r.date).sort();
  return dates.length ? dates[dates.length - 1] : `${ym.year}-${pad(ym.month)}-${pad(daysIn(ym.year, ym.month))}`;
}

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayMonth = (iso: string) => `${utc(iso).getUTCDate()} ${FULL_MONTHS[utc(iso).getUTCMonth()]}`;

/** "Friday, 13 November". */
export const longDateLabel = (iso: string): string => `${FULL_WEEKDAYS[utc(iso).getUTCDay()]}, ${dayMonth(iso)}`;

/** Spoken label for a calendar cell. */
export function cellA11yLabel(
  date: string,
  row: Pick<HistoryDay, 'calories' | 'calorieGoal'> | undefined,
  todayIso: string,
): string {
  const { state } = dayState(date, row, todayIso);
  const parts = [dayMonth(date)];
  if (date === todayIso) parts.push('today');
  if (state === 'future') parts.push('not available yet');
  else if (!row) parts.push('no entries');
  else {
    parts.push(`${formatKcal(row.calories)} calories`);
    if (state === 'over') parts.push('over goal');
    else if (state === 'within') parts.push('within goal');
  }
  return parts.join(', ');
}

/** "780 left" or "220 over". */
export function leftOrOverLabel(calories: number, goal: number): string {
  return calories > goal ? `${formatKcal(calories - goal)} over` : `${formatKcal(goal - calories)} left`;
}
