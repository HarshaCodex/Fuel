import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from '@/api/errors';
import { logout, refresh } from '@/api/auth';
import { apiClient, setSessionExpiredListener } from '@/api/client';
import { clearTokens, getTokens, setTokens, type Tokens } from '@/lib/tokenStorage';

type Status = 'loading' | 'signedOut' | 'signedIn';
type Session = { status: Status; signIn: (tokens: Tokens) => Promise<void>; signOut: () => Promise<void> };

const SessionContext = createContext<Session | null>(null);

function revokeOnServer(t: Tokens) {
  logout(t.refreshToken, t.accessToken).catch(async (e) => {
    if (!(e instanceof ApiError) || e.status !== 401) return;
    try {
      const next = await refresh(t.refreshToken);
      await logout(next.refreshToken, next.accessToken);
    } catch {
      // Best effort.
    }
  });
}

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
    apiClient.invalidate();
    let t: Tokens | null = null;
    try {
      t = await getTokens();
    } catch {
      // Unreadable storage: still sign out locally below.
    }
    try {
      await clearTokens();
    } catch {
      // Ignore; local state must still end.
    } finally {
      endLocally();
    }
    // Best effort and fire and forget, so a slow network never keeps the user signed in. Logout needs a
    // bearer; if the access token expired (401), rotate once through the public refresh route and retry
    // with the new pair. Nothing is written to storage.
    if (t) revokeOnServer(t);
  }, [endLocally]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
