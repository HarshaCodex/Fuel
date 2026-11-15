import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightColors } from '@/theme';

import { AmountPill } from './AmountPill';

describe('AmountPill', () => {
  it('shows the label, value and unit with a decimal keyboard', async () => {
    await render(<AmountPill value="100" onChangeText={() => {}} unit="g" />);
    expect(screen.getByText('Amount')).toBeTruthy();
    expect(screen.getByText('g')).toBeTruthy();
    const input = screen.getByLabelText('Amount in g');
    expect(input.props.value).toBe('100');
    expect(input.props.keyboardType).toBe('decimal-pad');
    expect(input.props.autoFocus).toBe(true);
  });

  it('reports typing and blur', async () => {
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    await render(<AmountPill value="100" onChangeText={onChangeText} onBlur={onBlur} unit="g" />);
    const input = screen.getByLabelText('Amount in g');
    await fireEvent.changeText(input, '175');
    expect(onChangeText).toHaveBeenCalledWith('175');
    await fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalled();
  });

  it('draws the accent ring only while focused', async () => {
    await render(<AmountPill value="100" onChangeText={() => {}} unit="g" />);
    const input = screen.getByLabelText('Amount in g');
    const pill = input.parent!.parent!;
    expect(pill).toHaveStyle({ borderColor: 'transparent' });
    await fireEvent(input, 'focus');
    expect(pill).toHaveStyle({ borderColor: lightColors.accent });
  });

  it('shows an error only when given one', async () => {
    const { rerender } = await render(<AmountPill value="" onChangeText={() => {}} unit="g" />);
    expect(screen.queryByRole('alert')).toBeNull();
    await rerender(<AmountPill value="" onChangeText={() => {}} unit="g" error="Enter an amount above 0" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
