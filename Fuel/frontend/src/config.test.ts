import { getApiBaseUrl } from './config';

describe('getApiBaseUrl', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });

  it('returns the configured URL without a trailing slash', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com/';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it.each([undefined, '', '   '])('throws when unset or blank (%p)', (value) => {
    if (value === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = value;
    expect(() => getApiBaseUrl()).toThrow('EXPO_PUBLIC_API_BASE_URL is not set');
  });

  it('throws for a non-http(s) URL', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'ftp://example.com';
    expect(() => getApiBaseUrl()).toThrow(/http/);
  });
});
