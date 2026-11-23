import { fireEvent, render, screen } from '@testing-library/react-native';

import { UnitPicker } from './UnitPicker';

describe('UnitPicker', () => {
  it('shows all eight units as radios with the current one selected', async () => {
    await render(<UnitPicker label="Unit" value="g" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(8);
    expect(radios.filter((r) => r.props.accessibilityState.selected).map((r) => r.props.accessibilityLabel)).toEqual(['g']);
  });

  it('reports the chosen unit', async () => {
    const onChange = jest.fn();
    await render(<UnitPicker label="Unit" value="g" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'cup' }));
    expect(onChange).toHaveBeenCalledWith('cup');
  });

  it('ignores presses when disabled', async () => {
    const onChange = jest.fn();
    await render(<UnitPicker label="Unit" value="g" onChange={onChange} disabled />);
    await fireEvent.press(screen.getByRole('radio', { name: 'ml' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
