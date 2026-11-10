import type { HistoryDay } from '@/api/tracking';
import { addDays } from './dashboardView';

export type RangeDays = 7 | 30 | 90;
export const RANGE_OPTIONS: readonly RangeDays[] = [7, 30, 90];
export type HistoryRange = { days: number; from: string; to: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Inclusive window of exactly `days` dates ending today. Never wider than 90, never narrower than 1. */
export function rangeFor(days: number, todayIso: string): HistoryRange {
  const n = Math.min(Math.max(Math.floor(days), 1), 90);
  return { days: n, from: addDays(todayIso, -(n - 1)), to: todayIso };
}

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "Mon 9 Nov". */
export function dayLabel(iso: string): string {
  const d = utc(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const entriesLabel = (n: number): string => (n === 1 ? '1 entry' : `${n} entries`);

export type ChartBar = {
  /** First date the bar covers. */
  date: string;
  /** Last date the bar covers; equals `date` for daily bars. */
  endDate: string;
  /** Whole calories: the day's total, or the average per logged day for a week. */
  calories: number;
  isToday: boolean;
  /** True when the bar averages a week rather than showing one day. */
  weekly: boolean;
};

/**
 * Daily bars for 7 and 30 days, with days the server omitted shown as 0.
 * Longer ranges are grouped into 7-day buckets ending today (the oldest may be partial),
 * each showing the average over the days actually logged.
 */
export function chartBars(days: HistoryDay[], range: HistoryRange, todayIso: string): ChartBar[] {
  const byDate = new Map(days.map((d) => [d.date, d.calories]));
  const bars: ChartBar[] = [];
  if (range.days <= 30) {
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      bars.push({ date, endDate: date, calories: Math.round(byDate.get(date) ?? 0), isToday: date === todayIso, weekly: false });
    }
    return bars;
  }
  for (let end = range.to; end >= range.from; end = addDays(end, -7)) {
    const start = addDays(end, -6) < range.from ? range.from : addDays(end, -6);
    const logged: number[] = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      const c = byDate.get(date);
      if (c !== undefined) logged.push(c);
    }
    const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
    bars.unshift({ date: start, endDate: end, calories: Math.round(avg), isToday: todayIso >= start && todayIso <= end, weekly: true });
  }
  return bars;
}

export type HistorySummaryModel = { averageCalories: number; daysLogged: number; daysOnGoal: number };

/** Average calories per logged day and how many logged days were at or under goal. */
export function summary(days: HistoryDay[]): HistorySummaryModel {
  const total = days.reduce((a, d) => a + d.calories, 0);
  return {
    averageCalories: days.length ? Math.round(total / days.length) : 0,
    daysLogged: days.length,
    daysOnGoal: days.filter((d) => d.calories <= d.calorieGoal).length,
  };
}
