import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef, type ComponentRef } from 'react';
import { TextInput } from 'react-native';

import { TextField } from './TextField';

describe('TextField', () => {
  it('labels the input and shows the error text', async () => {
    await render(<TextField label="Email" error="Enter a valid email address." />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });
  it('toggles secure entry and keeps the value', async () => {
    await render(<TextField label="Password" secure value="hunter2" onChangeText={() => {}} />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Password').props.value).toBe('hunter2');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
  it('forwards focus and blur handlers', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<TextField label="Email" onFocus={onFocus} onBlur={onBlur} />);
    await fireEvent(screen.getByLabelText('Email'), 'focus');
    await fireEvent(screen.getByLabelText('Email'), 'blur');
    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });
  it('keeps the input frame as a real native view so focus styling cannot rebuild the input on Android', async () => {
    await render(<TextField label="Email" />);
    type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
    const frame = (node: Node): Node | undefined =>
      node.children?.some((c) => typeof c !== 'string' && c.props.accessibilityLabel === 'Email')
        ? node
        : node.children?.reduce<Node | undefined>((found, c) => found ?? (typeof c === 'string' ? undefined : frame(c)), undefined);
    expect(frame(screen.toJSON() as Node)?.props.collapsable).toBe(false);
  });

  describe('pill variant', () => {
    it('puts the label inside the field and keeps the input accessible by label', async () => {
      await render(<TextField variant="pill" label="Email" value="a@b.co" onChangeText={() => {}} />);
      expect(screen.getByText('Email')).toBeTruthy();
      expect(screen.getByLabelText('Email').props.value).toBe('a@b.co');
    });
    it('toggles the password and shows the error under the field', async () => {
      await render(<TextField variant="pill" label="Password" secure error="Required" value="x" onChangeText={() => {}} />);
      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
      await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
      expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
      expect(screen.getByText('Required')).toBeTruthy();
    });
    it('keeps the frame a real native view and gives the eye a 44pt target', async () => {
      await render(<TextField variant="pill" label="Password" secure />);
      type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
      const frame = (node: Node): Node | undefined =>
        node.children?.some((c) => typeof c !== 'string' && c.props.collapsable === false)
          ? node
          : node.children?.reduce<Node | undefined>((f, c) => f ?? (typeof c === 'string' ? undefined : frame(c)), undefined);
      expect(frame(screen.toJSON() as Node)).toBeTruthy();
      const eye = screen.getByRole('button', { name: 'Show password' });
      const style = Object.assign({}, ...[eye.props.style].flat());
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    });
    it('focuses the input when the label is pressed, and still forwards the ref', async () => {
      const focus = jest.spyOn(TextInput.prototype, 'focus');
      const ref = createRef<ComponentRef<typeof TextInput>>();
      await render(<TextField variant="pill" label="Email" ref={ref} />);
      await fireEvent.press(screen.getByText('Email'));
      expect(focus).toHaveBeenCalled();
      expect(ref.current).toBeTruthy();
      focus.mockRestore();
    });
    it('forwards focus and blur', async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      await render(<TextField variant="pill" label="Email" onFocus={onFocus} onBlur={onBlur} />);
      await fireEvent(screen.getByLabelText('Email'), 'focus');
      await fireEvent(screen.getByLabelText('Email'), 'blur');
      expect(onFocus).toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalled();
    });
  });
});
