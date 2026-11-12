import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, useTheme } from '@/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

describe('useTheme', () => {
  it.each([
    ['dark', 'dark', darkColors],
    ['light', 'light', lightColors],
    [null, 'light', lightColors],
  ] as const)('maps scheme %s to %s', async (input, scheme, colors) => {
    mockScheme.mockReturnValue(input);
    expect(useColorScheme).toBeDefined();
    const { result } = await renderHook(() => useTheme());
    expect(result.current.scheme).toBe(scheme);
    expect(result.current.colors).toBe(colors);
  });
});
