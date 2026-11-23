import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  clearOnboardingSkipped,
  clearTokens,
  getOnboardingSkipped,
  getTokens,
  setOnboardingSkipped,
  setTokens,
} from './tokenStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const tokens = { accessToken: 'a', refreshToken: 'r' };

describe('tokenStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('on native', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('returns null when nothing is stored', async () => {
      await clearTokens();
      expect(await getTokens()).toBeNull();
    });

    it('round trips tokens through SecureStore', async () => {
      await setTokens(tokens);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fuel.tokens', JSON.stringify(tokens));
      expect(await getTokens()).toEqual(tokens);
    });

    it.each(['{not json', 'null', '{"accessToken":1}'])('treats corrupt value %s as signed out and clears it', async (bad) => {
      await SecureStore.setItemAsync('fuel.tokens', bad);
      expect(await getTokens()).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fuel.tokens');
      expect(await getTokens()).toBeNull();
    });

    it('clears stored tokens', async () => {
      await setTokens(tokens);
      await clearTokens();
      expect(await getTokens()).toBeNull();
    });
  });

  describe('on web', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('keeps tokens in memory without touching SecureStore or localStorage', async () => {
      const local = { setItem: jest.fn(), getItem: jest.fn() };
      Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
      await setTokens(tokens);
      expect(await getTokens()).toEqual(tokens);
      await clearTokens();
      expect(await getTokens()).toBeNull();
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(local.setItem).not.toHaveBeenCalled();
      expect(local.getItem).not.toHaveBeenCalled();
    });
  });
});

describe('onboarding skip flag', () => {
  it.each(['ios', 'web'] as const)('defaults false, sets and clears on %s', async (os) => {
    Platform.OS = os;
    await clearOnboardingSkipped();
    expect(await getOnboardingSkipped()).toBe(false);
    await setOnboardingSkipped();
    expect(await getOnboardingSkipped()).toBe(true);
    await clearOnboardingSkipped();
    expect(await getOnboardingSkipped()).toBe(false);
  });

  it('uses SecureStore on native and never on web', async () => {
    Platform.OS = 'web';
    jest.clearAllMocks();
    await setOnboardingSkipped();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    Platform.OS = 'ios';
    await setOnboardingSkipped();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fuel.onboardingSkipped', '1');
  });
});
