import { createApiClient } from './client';
import { ApiError, NetworkError } from './errors';

type Tok = { accessToken: string; refreshToken: string } | null;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

function setup(initial: Tok = { accessToken: 'old', refreshToken: 'r1' }) {
  let stored = initial;
  const tokens = {
    get: jest.fn(async () => stored),
    set: jest.fn(async (t: NonNullable<Tok>) => void (stored = t)),
    clear: jest.fn(async () => void (stored = null)),
  };
  const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>();
  const onSessionExpired = jest.fn();
  const client = createApiClient({
    baseUrl: () => 'http://api.test',
    tokens,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    onSessionExpired,
  });
  return { client, tokens, fetchImpl, onSessionExpired };
}
const auth = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;
const refreshOk = json(200, { data: { accessToken: 'new', refreshToken: 'r2' } });

describe('api client', () => {
  it('sends bearer, unwraps data', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json(200, { status: 200, data: { a: 1 } }));
    expect(await client.request('GET', '/api/x')).toEqual({ a: 1 });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/api/x');
    expect(auth(fetchImpl.mock.calls[0][1])).toBe('Bearer old');
  });

  it('sends no bearer under /api/auth and returns null for data null', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json(200, { data: null }));
    expect(await client.request('POST', '/api/auth/logout', { body: { refreshToken: 'r1' } })).toBeNull();
    expect(auth(fetchImpl.mock.calls[0][1])).toBeUndefined();
  });

  it('does not refresh on a public 401', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json(401, { status: 401, message: 'Invalid email or password!' }));
    await expect(client.request('POST', '/api/auth/login', { body: {} })).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('exposes fieldErrors, retryAfter and falls back on empty or non-JSON bodies', async () => {
    const { client, fetchImpl } = setup();
    const errors = [{ field: 'email', message: 'bad' }];
    fetchImpl.mockResolvedValueOnce(json(400, { message: 'Invalid', errors }));
    await expect(client.request('POST', '/api/y')).rejects.toMatchObject({ status: 400, fieldErrors: errors });
    fetchImpl.mockResolvedValueOnce(json(429, { message: 'Slow', retryAfter: 7 }, { 'Retry-After': '7' }));
    await expect(client.request('POST', '/api/y')).rejects.toMatchObject({ retryAfter: 7 });
    fetchImpl.mockResolvedValueOnce(json(429, undefined, { 'Retry-After': '3' }));
    await expect(client.request('POST', '/api/y')).rejects.toMatchObject({ retryAfter: 3 });
    fetchImpl.mockResolvedValueOnce(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(client.request('GET', '/api/y')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway', fieldErrors: [] });
  });

  it('maps fetch rejection to NetworkError', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValue(new TypeError('x'));
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('refreshes once for concurrent 401s and retries all with the new token', async () => {
    const { client, fetchImpl, tokens } = setup();
    fetchImpl.mockImplementation(async (url, init) => {
      if (url.endsWith('/api/auth/refresh')) return refreshOk.clone();
      return auth(init) === 'Bearer new' ? json(200, { data: 'ok' }) : json(401, { message: 'no' });
    });
    const results = await Promise.all([1, 2, 3, 4].map(() => client.request('GET', '/api/x')));
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(fetchImpl.mock.calls.filter(([u]) => u.endsWith('/refresh'))).toHaveLength(1);
    expect(JSON.parse(fetchImpl.mock.calls.find(([u]) => u.endsWith('/refresh'))![1].body as string)).toEqual({ refreshToken: 'r1' });
    expect(tokens.set).toHaveBeenCalledWith({ accessToken: 'new', refreshToken: 'r2' });
  });

  it('starts a new refresh for a later 401 after one completed', async () => {
    const { client, fetchImpl } = setup();
    let n = 0;
    let valid = 't1'; // the server accepts only this token
    fetchImpl.mockImplementation(async (url, init) => {
      if (url.endsWith('/refresh')) {
        n += 1;
        return json(200, { data: { accessToken: `t${n}`, refreshToken: `r${n}` } });
      }
      return auth(init) === `Bearer ${valid}` ? json(200, { data: 'ok' }) : json(401, {});
    });
    await client.request('GET', '/api/x');
    expect(n).toBe(1);
    valid = 't2'; // t1 revoked server-side
    await client.request('GET', '/api/x');
    expect(n).toBe(2);
  });

  it('retries without refreshing when the stored token is newer than the one sent', async () => {
    const { client, fetchImpl, tokens } = setup();
    fetchImpl.mockImplementationOnce(async () => {
      await tokens.set({ accessToken: 'newer', refreshToken: 'r9' });
      return json(401, {});
    });
    fetchImpl.mockResolvedValueOnce(json(200, { data: 'ok' }));
    expect(await client.request('GET', '/api/x')).toBe('ok');
    expect(auth(fetchImpl.mock.calls[1][1])).toBe('Bearer newer');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws ApiError on a second 401 without another refresh', async () => {
    const { client, fetchImpl, onSessionExpired } = setup();
    fetchImpl.mockImplementation(async (url) => (url.endsWith('/refresh') ? refreshOk.clone() : json(401, {})));
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('signs out once when refresh is rejected, rejecting all waiters', async () => {
    const { client, fetchImpl, tokens, onSessionExpired } = setup();
    fetchImpl.mockImplementation(async (url) => (url.endsWith('/refresh') ? json(401, {}) : json(401, {})));
    const out = await Promise.allSettled([client.request('GET', '/a'), client.request('GET', '/b')]);
    expect(out.map((o) => o.status)).toEqual(['rejected', 'rejected']);
    expect(tokens.clear).toHaveBeenCalled();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls.filter(([u]) => u.endsWith('/refresh'))).toHaveLength(1);
  });

  it.each([400, 403])('treats a %i from refresh as an expired session', async (status) => {
    const { client, fetchImpl, tokens, onSessionExpired } = setup();
    fetchImpl.mockImplementation(async (url) => json(url.endsWith('/refresh') ? status : 401, {}));
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(ApiError);
    expect(tokens.clear).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('keeps tokens when refresh hits a network error', async () => {
    const { client, fetchImpl, tokens, onSessionExpired } = setup();
    fetchImpl.mockImplementation(async (url) => {
      if (url.endsWith('/refresh')) throw new TypeError('offline');
      return json(401, {});
    });
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(NetworkError);
    expect(tokens.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('expires without calling refresh when no tokens are stored', async () => {
    const { client, fetchImpl, onSessionExpired } = setup(null);
    fetchImpl.mockResolvedValue(json(401, {}));
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('never logs tokens or puts them in errors', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json(500, { message: 'boom' }));
    const err = await client.request<unknown>('POST', '/api/x', { body: { password: 'secret' } }).catch((e: Error) => e);
    expect(JSON.stringify(err)).not.toMatch(/old|r1|secret/);
    expect((err as Error).message).not.toMatch(/old|r1|secret/);
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    spies.forEach((s) => s.mockRestore());
  });

  it('does not write refreshed tokens if the session ended during the refresh', async () => {
    const { client, fetchImpl, tokens } = setup();
    fetchImpl.mockImplementation(async (url) => {
      if (url.endsWith('/refresh')) {
        await tokens.clear(); // user signs out while the refresh is in flight
        return refreshOk.clone();
      }
      return json(401, {});
    });
    await expect(client.request('GET', '/api/x')).rejects.toBeInstanceOf(ApiError);
    expect(tokens.set).not.toHaveBeenCalled();
  });

  it('rejects a 2xx without a JSON envelope but accepts 204', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(new Response('<html>', { status: 200, statusText: 'OK' }));
    await expect(client.request('GET', '/api/x')).rejects.toMatchObject({ status: 200 });
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await client.request('DELETE', '/api/x')).toBeNull();
  });

  it('uses an explicit bearer without refreshing on 401', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json(401, {}));
    await expect(client.request('POST', '/api/auth/logout', { bearer: 'cap' })).rejects.toMatchObject({ status: 401 });
    expect(auth(fetchImpl.mock.calls[0][1])).toBe('Bearer cap');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
