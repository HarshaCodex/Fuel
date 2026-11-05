import { getApiBaseUrl } from '@/config';
import { clearTokens, getTokens, setTokens, type Tokens } from '@/lib/tokenStorage';

import { ApiError, NetworkError, type FieldError } from './errors';

type TokenStore = {
  get: () => Promise<Tokens | null>;
  set: (tokens: Tokens) => Promise<void>;
  clear: () => Promise<void>;
};

type Options = {
  baseUrl: () => string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  onSessionExpired: () => void;
};

export type RequestOptions = {
  body?: unknown;
  auth?: boolean;
  /** Send exactly this bearer and never refresh or retry (used for logout after local sign-out). */
  bearer?: string;
};

type Envelope<T> = { data: T | null };
type ErrorBody = { message?: string; errors?: FieldError[]; retryAfter?: number };

const REFRESH_PATH = '/api/auth/refresh';
const isPublic = (path: string) => path.startsWith('/api/auth/');

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await parseJson(res)) as ErrorBody | null;
  const header = Number(res.headers.get('Retry-After'));
  const retryAfter = typeof body?.retryAfter === 'number' ? body.retryAfter : header > 0 ? header : undefined;
  const message = typeof body?.message === 'string' && body.message ? body.message : res.statusText;
  return new ApiError(res.status, message, Array.isArray(body?.errors) ? body.errors : [], retryAfter);
}

export function createApiClient({ baseUrl, tokens, fetchImpl, onSessionExpired }: Options) {
  let refreshing: Promise<string> | null = null;

  async function send(method: string, path: string, body: unknown, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await (fetchImpl ?? fetch)(baseUrl() + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError();
    }
  }

  async function expire(): Promise<never> {
    await tokens.clear();
    onSessionExpired();
    throw new ApiError(401, 'Session expired');
  }

  async function doRefresh(): Promise<string> {
    const current = await tokens.get();
    if (!current) return expire();
    const res = await send('POST', REFRESH_PATH, { refreshToken: current.refreshToken }, null);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) return expire();
      throw await toApiError(res);
    }
    const next = ((await parseJson(res)) as Envelope<Tokens> | null)?.data;
    if (!next?.accessToken || !next.refreshToken) return expire();
    // A sign-out or expiry during the round trip must not be undone by writing fresh tokens.
    const now = await tokens.get();
    if (now?.refreshToken !== current.refreshToken) throw new ApiError(401, 'Session ended');
    await tokens.set({ accessToken: next.accessToken, refreshToken: next.refreshToken });
    return next.accessToken;
  }

  /** One shared in-flight refresh, so concurrent 401s trigger a single call. */
  function refresh(): Promise<string> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function request<T>(
    method: string,
    path: string,
    { body, auth = !isPublic(path), bearer }: RequestOptions = {},
  ) {
    if (bearer) {
      const res = await send(method, path, body, bearer);
      if (!res.ok) throw await toApiError(res);
      return null as T;
    }
    const sent = auth ? ((await tokens.get())?.accessToken ?? null) : null;
    let res = await send(method, path, body, sent);
    if (res.status === 401 && auth) {
      const stored = (await tokens.get())?.accessToken ?? null;
      const fresh = stored && stored !== sent ? stored : await refresh();
      res = await send(method, path, body, fresh);
    }
    if (!res.ok) throw await toApiError(res);
    const parsed = (await parseJson(res)) as Envelope<T> | null;
    // A 2xx without a JSON envelope (e.g. a proxy page) is an error, except 204.
    if (!parsed && res.status !== 204) throw new ApiError(res.status, res.statusText || 'Unexpected response');
    return (parsed?.data ?? null) as T;
  }

  return { request };
}

let sessionExpiredListener: (() => void) | null = null;
/** SessionProvider registers here so a failed refresh returns the user to the auth stack. */
export function setSessionExpiredListener(fn: (() => void) | null) {
  sessionExpiredListener = fn;
}

export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl,
  tokens: { get: getTokens, set: setTokens, clear: clearTokens },
  // Replaced by SessionProvider on mount.
  onSessionExpired: () => sessionExpiredListener?.(),
});
