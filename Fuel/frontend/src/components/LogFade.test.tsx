import { render, screen } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';

import { darkColors, lightColors } from '@/theme';

import { LogFade } from './LogFade';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

describe('LogFade', () => {
  it('ignores touches and sits flush above its own height', async () => {
    mockScheme.mockReturnValue('light');
    await render(<LogFade height={64} />);
    const fade = screen.getByTestId('log-fade');
    expect(fade.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(fade.props.style)).toMatchObject({ height: 64, top: -64 });
  });

  it.each([
    ['light', lightColors.bg],
    ['dark', darkColors.bg],
  ])('fades to the %s background', async (scheme, bg) => {
    mockScheme.mockReturnValue(scheme);
    const { toJSON } = await render(<LogFade />);
    const json = JSON.stringify(toJSON());
    const [, , , solid] = JSON.parse(json.match(/"gradient":(\[[^\]]*\])/)![1]) as number[];
    expect(solid).toBe((processColor(bg) as number) | 0);
  });
});
