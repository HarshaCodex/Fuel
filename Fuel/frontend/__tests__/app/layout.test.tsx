import { render } from '@testing-library/react-native';

import { ThemedStatusBar } from '../../app/_layout';

jest.mock('expo-router', () => ({ Stack: Object.assign(() => null, { Protected: () => null, Screen: () => null }) }));
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
