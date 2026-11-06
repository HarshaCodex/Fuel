import { fireEvent, render, screen } from '@testing-library/react-native';

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
});
