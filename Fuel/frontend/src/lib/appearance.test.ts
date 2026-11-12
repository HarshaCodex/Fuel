import * as SecureStore from 'expo-secure-store';
import { Appearance, Platform } from 'react-native';

import {
  APPEARANCE_OPTIONS,
  appearanceLabel,
  applyStoredAppearance,
  getAppearance,
  setAppearance,
} from './appearance';
import { clearTokens } from './tokenStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => store.get(k) ?? null),
    setItem: jest.fn((k: string, v: string) => void store.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const mocked = SecureStore as jest.Mocked<typeof SecureStore>;

describe('appearance', () => {
  let setScheme: jest.SpyInstance;
  beforeEach(() => {
    Platform.OS = 'ios';
    setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    mocked.setItem('fuel.appearance', 'system');
    jest.clearAllMocks();
  });

  it('defaults to system when nothing is stored', () => {
    mocked.getItem.mockReturnValueOnce(null);
    expect(getAppearance()).toBe('system');
  });

  it('falls back to system for an unknown stored value', () => {
    mocked.getItem.mockReturnValueOnce('purple');
    expect(getAppearance()).toBe('system');
  });

  it('falls back to system when SecureStore throws', () => {
    mocked.getItem.mockImplementationOnce(() => {
      throw new Error('keychain locked');
    });
    expect(getAppearance()).toBe('system');
    expect(() => applyStoredAppearance()).not.toThrow();
  });

  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    ['system', 'unspecified'],
  ] as const)('setAppearance(%s) persists and applies %s', (choice, scheme) => {
    setAppearance(choice);
    expect(mocked.setItem).toHaveBeenCalledWith('fuel.appearance', choice);
    expect(setScheme).toHaveBeenCalledWith(scheme);
    expect(getAppearance()).toBe(choice);
  });

  it('still applies the choice when saving fails', () => {
    mocked.setItem.mockImplementationOnce(() => {
      throw new Error('full');
    });
    expect(() => setAppearance('dark')).not.toThrow();
    expect(setScheme).toHaveBeenCalledWith('dark');
  });

  it('applyStoredAppearance applies the stored choice', () => {
    setAppearance('dark');
    setScheme.mockClear();
    applyStoredAppearance();
    expect(setScheme).toHaveBeenCalledWith('dark');
  });

  it('keeps the choice in memory on web', () => {
    Platform.OS = 'web';
    setAppearance('light');
    expect(mocked.setItem).not.toHaveBeenCalled();
    expect(getAppearance()).toBe('light');
    setAppearance('system');
  });

  it('is not removed by clearTokens', async () => {
    setAppearance('dark');
    await clearTokens();
    expect(mocked.deleteItemAsync).not.toHaveBeenCalledWith('fuel.appearance');
    expect(getAppearance()).toBe('dark');
  });

  it('lists the three options with labels', () => {
    expect(APPEARANCE_OPTIONS.map((o) => o.value)).toEqual(['system', 'light', 'dark']);
    expect(appearanceLabel('dark')).toBe('Dark');
  });
});
