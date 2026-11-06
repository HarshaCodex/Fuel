import { forgotPassword, login, refresh, register, resendVerification, resetPassword, verifyEmail } from './auth';

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

  it.each([
    ['register', () => register({ email: 'a@b.c', password: 'Pw1!pw1!', name: 'N', timezone: 'UTC' }), '/api/auth/register', { email: 'a@b.c', password: 'Pw1!pw1!', name: 'N', timezone: 'UTC' }],
    ['verifyEmail', () => verifyEmail('a@b.c', '123456'), '/api/auth/verify-email', { email: 'a@b.c', verificationCode: '123456' }],
    ['resendVerification', () => resendVerification('a@b.c'), '/api/auth/resend-verification', { email: 'a@b.c' }],
    ['forgotPassword', () => forgotPassword('a@b.c'), '/api/auth/forgot-password', { email: 'a@b.c' }],
    ['resetPassword', () => resetPassword('a@b.c', '123456', 'Pw1!pw1!'), '/api/auth/reset-password', { email: 'a@b.c', resetCode: '123456', newPassword: 'Pw1!pw1!' }],
  ])('%s posts the body to its path without a bearer and unwraps data', async (_n, call, path, body) => {
    const result = await call();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test' + path);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual(body);
    expect(result).toEqual({ accessToken: 'a' });
  });
});
