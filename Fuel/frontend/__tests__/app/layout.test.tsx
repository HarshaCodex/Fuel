import { render } from '@testing-library/react-native';

import RootLayout, { ThemedStatusBar } from '../../app/_layout';

const mockUseFonts = jest.fn();
jest.mock('@expo-google-fonts/manrope', () => ({ useFonts: (...args: unknown[]) => mockUseFonts(...args) }));
jest.mock('@expo-google-fonts/manrope/400Regular', () => ({ Manrope_400Regular: 1 }));
jest.mock('@expo-google-fonts/manrope/500Medium', () => ({ Manrope_500Medium: 2 }));
jest.mock('@expo-google-fonts/manrope/600SemiBold', () => ({ Manrope_600SemiBold: 3 }));
jest.mock('@expo-google-fonts/manrope/700Bold', () => ({ Manrope_700Bold: 4 }));
jest.mock('@expo-google-fonts/manrope/800ExtraBold', () => ({ Manrope_800ExtraBold: 5 }));
const mockHide = jest.fn(() => Promise.resolve());
jest.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(() => Promise.resolve()), hideAsync: () => mockHide() },
  Stack: Object.assign(() => null, { Protected: () => null, Screen: () => null }),
}));
jest.mock('@/session/SessionProvider', () => ({ SessionProvider: () => null, useSession: () => ({ status: 'loading' }) }));
jest.mock('@/session/FirstRunGate', () => ({ FirstRunGate: () => null }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({ __esModule: true, default: jest.fn(() => null) }));
const mockBar = jest.requireMock('react-native/Libraries/Components/StatusBar/StatusBar').default as jest.Mock;
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

describe('ThemedStatusBar', () => {
  it.each([
    ['dark', 'light-content'],
    ['light', 'dark-content'],
    [null, 'dark-content'],
  ] as const)('with scheme %s uses %s', async (scheme, style) => {
    mockScheme.mockReturnValue(scheme);
    await render(<ThemedStatusBar />);
    expect(mockBar.mock.calls.at(-1)?.[0].barStyle).toBe(style);
  });
});

describe('RootLayout font loading', () => {
  beforeEach(() => mockHide.mockClear());

  it('holds the splash and renders nothing until fonts load', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { toJSON } = await render(<RootLayout />);
    expect(toJSON()).toBeNull();
    expect(mockHide).not.toHaveBeenCalled();
  });

  it('hides the splash once fonts are loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(mockHide).toHaveBeenCalledTimes(1);
  });

  it('hides the splash and falls back to system fonts when loading fails', async () => {
    mockUseFonts.mockReturnValue([false, new Error('network')]);
    const { toJSON } = await render(<RootLayout />);
    expect(toJSON()).not.toBeNull();
    expect(mockHide).toHaveBeenCalledTimes(1);
  });
});
