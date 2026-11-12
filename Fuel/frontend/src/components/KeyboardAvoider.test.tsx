import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet, Text } from 'react-native';

import { KeyboardAvoider } from '@/components/KeyboardAvoider';

type Handler = (e: { endCoordinates: { height: number } }) => void;

function mockKeyboard() {
  const handlers: Record<string, Handler> = {};
  const remove = jest.fn();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: Handler) => {
    handlers[name] = fn;
    return { remove };
  }) as unknown as typeof Keyboard.addListener);
  return { handlers, remove };
}

function paddingBottom() {
  const root = screen.toJSON() as unknown as { props: { style: object } };
  return StyleSheet.flatten(root.props.style as never).paddingBottom;
}

describe('KeyboardAvoider', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    jest.restoreAllMocks();
  });

  const ui = (
    <KeyboardAvoider>
      <Text>content</Text>
    </KeyboardAvoider>
  );

  it('lifts content by the keyboard height on iOS and drops it when the keyboard hides', async () => {
    Platform.OS = 'ios';
    const { handlers } = mockKeyboard();
    await render(ui);
    await act(async () => handlers.keyboardWillShow({ endCoordinates: { height: 300 } }));
    expect(paddingBottom()).toBe(300);
    await act(async () => handlers.keyboardWillHide({ endCoordinates: { height: 0 } }));
    expect(paddingBottom()).toBe(0);
  });

  it('does not listen to the keyboard on Android, which resizes the window itself', async () => {
    Platform.OS = 'android';
    mockKeyboard();
    await render(ui);
    expect(Keyboard.addListener).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', async () => {
    Platform.OS = 'ios';
    const { remove } = mockKeyboard();
    const view = await render(ui);
    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
