import { login, refresh } from './auth';

const fetchMock = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{"data":{"accessToken":"a"}}', { status: 200 }));
});

describe('auth api', () => {
  it('login posts credentials without a bearer', async () => {
    await login('a@b.c', 'pw');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c', password: 'pw' });
  });

  it('refresh posts the refresh token without a bearer', async () => {
    await refresh('r');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/refresh');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'r' });
  });
});
