import { fireEvent, render, screen } from '@testing-library/react-native';

import { OptionRow } from './OptionRow';
import { SegmentedControl } from './SegmentedControl';
import { Stepper } from './Stepper';

describe('SegmentedControl', () => {
  const options = [
    { value: 'A', label: 'Alpha' },
    { value: 'B', label: 'Beta' },
  ] as const;
  it('marks the selected radio and reports a change', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl label="Pick" options={options} value="A" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Alpha' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('B');
  });
});

describe('OptionRow', () => {
  it('is a radio with its description and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<OptionRow label="Active" description="Hard exercise" selected onPress={onPress} />);
    const row = screen.getByRole('radio', { name: 'Active. Hard exercise' });
    expect(row.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Stepper', () => {
  it('steps and clamps at the limits', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<Stepper label="Change" value={500} min={100} max={1000} step={50} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Change' }));
    expect(onChange).toHaveBeenLastCalledWith(550);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Change' }));
    expect(onChange).toHaveBeenLastCalledWith(450);
    await rerender(<Stepper label="Change" value={1000} min={100} max={1000} step={50} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Increase Change' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
});
