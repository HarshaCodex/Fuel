import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { logout } from '@/api/auth';
import { setSessionExpiredListener } from '@/api/client';
import { clearTokens, getTokens, setTokens, type Tokens } from '@/lib/tokenStorage';

type Status = 'loading' | 'signedOut' | 'signedIn';
type Session = { status: Status; signIn: (tokens: Tokens) => Promise<void>; signOut: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

/** Exposes auth status; consumers render nothing while `loading` (router needs the layout mounted). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');

  const endLocally = useCallback(() => {
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    getTokens().then(
      (t) => active && setStatus(t ? 'signedIn' : 'signedOut'),
      () => active && setStatus('signedOut'),
    );
    setSessionExpiredListener(endLocally);
    return () => {
      active = false;
      setSessionExpiredListener(null);
    };
  }, [endLocally]);

  const signIn = useCallback(async (tokens: Tokens) => {
    await setTokens(tokens);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const t = await getTokens();
    await clearTokens();
    endLocally();
    // Fire and forget so a slow network never keeps the user signed in. Logout needs the bearer,
    // so it uses the captured access token and skips refresh (the refresh token is in the body).
    if (t) logout(t.refreshToken, t.accessToken).catch(() => undefined);
  }, [endLocally]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
