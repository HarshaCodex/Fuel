import { fireEvent, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';
import { Text } from 'react-native';

import { darkColors, lightColors } from '@/theme';

import { Button } from './Button';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('ignores taps while loading and reports busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" loading onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Go' });
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
  it('ignores taps when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Go" disabled variant="secondary" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).not.toHaveBeenCalled();
  });
  it.each(['primary', 'inverse', 'surface', 'text'] as const)('pill %s calls onPress and shows its icon', async (variant) => {
    const onPress = jest.fn();
    await render(<Button pill variant={variant} label="Go" icon={<Text>glyph</Text>} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('glyph')).toBeTruthy();
  });
  it('pill ignores taps when disabled or loading', async () => {
    const onPress = jest.fn();
    await render(<Button pill label="Go" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).not.toHaveBeenCalled();
    await render(<Button pill label="Busy" loading onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Busy' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
  describe('pill colours', () => {
    afterEach(() => jest.restoreAllMocks());
    it.each([
      ['light', lightColors],
      ['dark', darkColors],
    ] as const)('inverse uses the text fill and bg label in %s', async (scheme, c) => {
      jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
      await render(<Button pill variant="inverse" label="Go" onPress={() => {}} />);
      expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({ backgroundColor: c.text });
      expect(screen.getByText('Go')).toHaveStyle({ color: c.bg });
    });
    it('surface has a hairline in dark and none in light', async () => {
      jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
      await render(<Button pill variant="surface" label="Go" onPress={() => {}} />);
      expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({ backgroundColor: darkColors.surface, borderColor: darkColors.border });
      jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
      await render(<Button pill variant="surface" label="Light" onPress={() => {}} />);
      expect(screen.getByRole('button', { name: 'Light' })).not.toHaveStyle({ borderColor: lightColors.border });
    });
  });
});
