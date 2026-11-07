import { render, screen } from '@testing-library/react-native';

import { StreakChip } from './StreakChip';

describe('StreakChip', () => {
  it.each([
    [12, '12 day streak'],
    [1, '1 day streak'],
    [1234, '1,234 day streak'],
  ])('shows %s as "%s" with a matching label', async (current, text) => {
    await render(<StreakChip current={current} />);
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByLabelText(text)).toBeOnTheScreen();
  });

  it.each([0, -3])('renders nothing for %s', async (current) => {
    await render(<StreakChip current={current} />);
    expect(screen.toJSON()).toBeNull();
  });
});
