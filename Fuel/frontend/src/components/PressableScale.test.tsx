import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { PressableScale } from './PressableScale';

let reduce = false;
beforeEach(() => {
  reduce = false;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => Promise.resolve(reduce));
});
afterEach(() => jest.restoreAllMocks());

const mount = async (props: Partial<React.ComponentProps<typeof PressableScale>> = {}) => {
  await render(
    <PressableScale accessibilityRole="button" accessibilityLabel="Hold me" {...props}>
      <Text>Hold me</Text>
    </PressableScale>,
  );
  await act(async () => {});
};

describe('PressableScale', () => {
  it('springs to 0.98 when pressed and back to 1 when released', async () => {
    const spring = jest.spyOn(Animated, 'spring');
    await mount();
    const btn = screen.getByRole('button', { name: 'Hold me' });
    await fireEvent(btn, 'pressIn');
    expect(spring).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.98 }));
    await fireEvent(btn, 'pressOut');
    expect(spring).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1 }));
  });

  it('does not animate when Reduce Motion is on', async () => {
    reduce = true;
    const spring = jest.spyOn(Animated, 'spring');
    await mount();
    const btn = screen.getByRole('button', { name: 'Hold me' });
    await fireEvent(btn, 'pressIn');
    await fireEvent(btn, 'pressOut');
    expect(spring).not.toHaveBeenCalled();
  });

  it('still calls onPress, onPressIn, onPressOut and onLongPress', async () => {
    const h = { onPress: jest.fn(), onPressIn: jest.fn(), onPressOut: jest.fn(), onLongPress: jest.fn() };
    await mount(h);
    const btn = screen.getByRole('button', { name: 'Hold me' });
    await fireEvent(btn, 'pressIn');
    await fireEvent(btn, 'pressOut');
    await fireEvent.press(btn);
    await fireEvent(btn, 'longPress');
    expect(h.onPressIn).toHaveBeenCalledTimes(1);
    expect(h.onPressOut).toHaveBeenCalledTimes(1);
    expect(h.onPress).toHaveBeenCalledTimes(1);
    expect(h.onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    await mount({ onPress, disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Hold me' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
