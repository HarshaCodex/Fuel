import { fireEvent, render, screen } from '@testing-library/react-native';

import { hapticSelect } from '@/lib/haptics';

import { MealPills } from './MealPills';

jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));
afterEach(() => jest.clearAllMocks());

describe('MealPills', () => {
  it('shows the eyebrow and a Meal radiogroup in the issue order', async () => {
    await render(<MealPills selected="lunch" onSelect={() => {}} />);
    expect(screen.getByText('Meal')).toBeTruthy();
    expect(screen.getByLabelText('Meal').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner']);
  });

  it('marks only the selected meal', async () => {
    await render(<MealPills selected="lunch" onSelect={() => {}} />);
    expect(screen.getByLabelText('Lunch')).toBeSelected();
    expect(screen.getByLabelText('Dinner')).not.toBeSelected();
  });

  it('selects with a haptic on a real change only', async () => {
    const onSelect = jest.fn();
    await render(<MealPills selected="lunch" onSelect={onSelect} />);
    await fireEvent.press(screen.getByLabelText('Lunch'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(hapticSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Snack'));
    expect(onSelect).toHaveBeenCalledWith('snack');
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });
});
