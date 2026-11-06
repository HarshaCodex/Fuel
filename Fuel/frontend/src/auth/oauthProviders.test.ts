import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from './oauthProviders';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const signIn = jest.mocked(GoogleSignin.signIn);
const appleSignIn = jest.mocked(AppleAuthentication.signInAsync);
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-id';
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-id';
});

describe('signInWithGoogle', () => {
  it('configures once and returns the ID token', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } } as never);
    expect(await signInWithGoogle()).toEqual({ idToken: 'tok' });
    await signInWithGoogle();
    expect(GoogleSignin.configure).toHaveBeenCalledTimes(1);
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'web-id', iosClientId: 'ios-id' });
  });

  it('returns null when cancelled', async () => {
    signIn.mockResolvedValue({ type: 'cancelled', data: null } as never);
    expect(await signInWithGoogle()).toBeNull();
  });

  it('throws when no ID token comes back', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: null } } as never);
    await expect(signInWithGoogle()).rejects.toThrow('ID token');
  });

  it('checks Play Services on Android only', async () => {
    signIn.mockResolvedValue({ type: 'success', data: { idToken: 'tok' } } as never);
    setOS('ios');
    await signInWithGoogle();
    expect(GoogleSignin.hasPlayServices).not.toHaveBeenCalled();
    setOS('android');
    await signInWithGoogle();
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalledTimes(1);
  });
});

describe('signInWithApple', () => {
  it('returns the token with the name when Apple provides it', async () => {
    appleSignIn.mockResolvedValue({
      identityToken: 'id',
      authorizationCode: 'code',
      fullName: { givenName: 'A', familyName: 'B', middleName: null },
    } as never);
    expect(await signInWithApple()).toEqual({
      identityToken: 'id',
      authorizationCode: 'code',
      fullName: { givenName: 'A', familyName: 'B' },
    });
  });

  it('omits fullName and code when absent', async () => {
    appleSignIn.mockResolvedValue({ identityToken: 'id', authorizationCode: null, fullName: null } as never);
    expect(await signInWithApple()).toEqual({ identityToken: 'id' });
  });

  it('returns null on ERR_REQUEST_CANCELED', async () => {
    appleSignIn.mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await signInWithApple()).toBeNull();
  });

  it('rethrows other errors and a missing identity token', async () => {
    appleSignIn.mockRejectedValue(new Error('boom'));
    await expect(signInWithApple()).rejects.toThrow('boom');
    appleSignIn.mockResolvedValue({ identityToken: null } as never);
    await expect(signInWithApple()).rejects.toThrow('identity token');
  });
});

describe('isAppleSignInAvailable', () => {
  it('is false off iOS without asking the SDK', async () => {
    setOS('android');
    expect(await isAppleSignInAvailable()).toBe(false);
    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('follows isAvailableAsync on iOS', async () => {
    setOS('ios');
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(true);
    expect(await isAppleSignInAvailable()).toBe(true);
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(false);
    expect(await isAppleSignInAvailable()).toBe(false);
  });
});
