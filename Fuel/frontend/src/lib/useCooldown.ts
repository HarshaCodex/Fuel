import { useCallback, useEffect, useState } from 'react';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** `m:ss`, e.g. 45 -> "0:45". */
export function formatCooldown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(s % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/**
 * Counts down whole seconds. Derived from an end timestamp so a backgrounded app does not drift.
 */
export function useCooldown(initialSeconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * MS_PER_SECOND);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((endsAt - now) / MS_PER_SECOND));

  useEffect(() => {
    if (endsAt <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) clearInterval(id);
    }, MS_PER_SECOND);
    return () => clearInterval(id);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * MS_PER_SECOND);
  }, []);

  return { remaining, start };
}
