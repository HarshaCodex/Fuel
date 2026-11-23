import { getApiBaseUrl, getGoogleClientIds } from './config';

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

describe('getGoogleClientIds', () => {
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  afterEach(() => {
    if (web === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = web;
    if (ios === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ios;
  });

  it('returns both IDs trimmed', () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ' web ';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios';
    expect(getGoogleClientIds()).toEqual({ webClientId: 'web', iosClientId: 'ios' });
  });

  it('leaves the iOS ID undefined when blank', () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '';
    expect(getGoogleClientIds().iosClientId).toBeUndefined();
  });

  it.each([undefined, '', '  '])('throws when the web ID is unset or blank (%p)', (value) => {
    if (value === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = value;
    expect(() => getGoogleClientIds()).toThrow('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
  });
});
