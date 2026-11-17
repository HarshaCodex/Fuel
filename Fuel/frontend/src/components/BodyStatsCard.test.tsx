import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BodyStats } from '@/api/user';

import { BODY_STATS_EMPTY, BodyStatsCard } from './BodyStatsCard';

const stats: BodyStats = { height: 178, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 32, gender: 'MALE', activityLevel: 'MODERATE', updatedAt: '2026-11-01T00:00:00Z' };

describe('BodyStatsCard', () => {
  it('shows four columns and opens Edit body stats from the whole card', async () => {
    const onPress = jest.fn();
    await render(<BodyStatsCard stats={stats} onPress={onPress} />);
    for (const t of ['178 cm', '80 kg', '32', 'Moderate', 'Height', 'Weight', 'Age', 'Activity']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    await fireEvent.press(screen.getByLabelText(/^Height 178 cm, Weight 80 kg, Age 32, Activity Moderate\. Edit body stats$/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the empty copy and an Add body stats button when there are none', async () => {
    const onPress = jest.fn();
    await render(<BodyStatsCard stats={null} onPress={onPress} />);
    expect(screen.getByText(BODY_STATS_EMPTY)).toBeTruthy();
    expect(screen.queryByText('Height')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add body stats' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
