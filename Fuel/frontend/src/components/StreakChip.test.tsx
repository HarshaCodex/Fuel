import { render, screen } from '@testing-library/react-native';

import { StreakChip } from './StreakChip';

describe('StreakChip', () => {
  it.each([
    [12, '12 days', 'Streak, 12 days'],
    [1, '1 day', 'Streak, 1 day'],
    [1234, '1,234 days', 'Streak, 1,234 days'],
  ])('shows %s as "%s" with the label "%s"', async (current, text, label) => {
    await render(<StreakChip current={current} />);
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  it.each([0, -3])('renders nothing for %s', async (current) => {
    await render(<StreakChip current={current} />);
    expect(screen.toJSON()).toBeNull();
  });
});
