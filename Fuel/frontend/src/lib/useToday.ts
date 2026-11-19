import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getProfile, userKeys } from '@/api/user';
import { trackingKeys } from '@/api/tracking';
import { msUntilNextMidnight, todayInTimezone } from '@/lib/today';
import { deviceTimezone } from '@/lib/timezones';

const PROFILE_STALE_MS = 5 * 60 * 1000;
const BUFFER_MS = 1000;
const MAX_TIMER_MS = 25 * 60 * 60 * 1000;

/**
 * Today's date (YYYY-MM-DD) in the profile timezone. It moves on at midnight with the app open and when the app comes
 * back to the foreground, and it refetches tracking data whenever the date changes.
 */
export function useToday(): string {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: userKeys.profile, queryFn: getProfile, staleTime: PROFILE_STALE_MS });
  const tz = profile.data?.timezone ?? deviceTimezone();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const wait = Math.min(msUntilNextMidnight(tz, now) + BUFFER_MS, MAX_TIMER_MS);
    const timer = setTimeout(() => setNow(new Date()), wait);
    return () => clearTimeout(timer);
  }, [tz, now]);

  const today = todayInTimezone(tz, now);
  const previous = useRef(today);
  useEffect(() => {
    if (previous.current === today) return;
    previous.current = today;
    void qc.invalidateQueries({ queryKey: trackingKeys.all });
  }, [today, qc]);

  return today;
}
