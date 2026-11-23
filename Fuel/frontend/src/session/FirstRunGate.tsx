import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { getBodyStats, userKeys } from '@/api/user';
import { getOnboardingSkipped } from '@/lib/tokenStorage';

/**
 * Sends a signed-in user with no saved body stats to onboarding, once per signed-in session.
 * Renders nothing. A failed fetch or unreadable flag never blocks the app: the user stays on Today.
 * Mount only while signed in; unmounting on sign-out resets the "once" guard.
 */
export function FirstRunGate() {
  const router = useRouter();
  const handled = useRef(false);
  const { data } = useQuery({ queryKey: userKeys.bodyStats, queryFn: getBodyStats });

  useEffect(() => {
    if (data !== null || handled.current) return; // undefined = loading or error
    handled.current = true;
    let active = true;
    getOnboardingSkipped().then(
      (skipped) => active && !skipped && router.replace('/onboarding'),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [data, router]);

  return null;
}
