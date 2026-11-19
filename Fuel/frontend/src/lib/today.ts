import { isoDate } from '@/lib/dashboardView';

const parts = (tz: string | undefined, now: Date, opts: Intl.DateTimeFormatOptions) => {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }).formatToParts(now)) out[p.type] = p.value;
  return out;
};

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. A missing or invalid zone falls back to the phone's. */
export function todayInTimezone(tz: string | undefined, now: Date = new Date()): string {
  if (!tz) return isoDate(now);
  try {
    const p = parts(tz, now, { year: 'numeric', month: '2-digit', day: '2-digit' });
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return isoDate(now);
  }
}

/** Milliseconds until the next midnight in `tz`, always above zero. DST days can be off by an hour: re-check when it fires. */
export function msUntilNextMidnight(tz: string | undefined, now: Date = new Date()): number {
  let h = now.getHours();
  let m = now.getMinutes();
  let s = now.getSeconds();
  if (tz) {
    try {
      const p = parts(tz, now, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      h = Number(p.hour) % 24;
      m = Number(p.minute);
      s = Number(p.second);
    } catch {
      // Invalid zone: keep the phone's clock, matching todayInTimezone.
    }
  }
  return ((24 * 60 - (h * 60 + m)) * 60 - s) * 1000 - now.getMilliseconds();
}
