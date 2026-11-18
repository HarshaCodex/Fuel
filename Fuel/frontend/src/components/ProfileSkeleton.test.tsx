import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { ProfileSkeleton } from './ProfileSkeleton';

describe('ProfileSkeleton', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is one progress element', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<ProfileSkeleton header goals body />);
    expect(screen.getByRole('progressbar', { name: 'Loading your profile' })).toBeOnTheScreen();
  });

  it('pulses by default and stops the loop on unmount', async () => {
    const stop = jest.fn();
    const start = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
    const { unmount } = await render(<ProfileSkeleton goals />);
    expect(start).toHaveBeenCalled();
    await unmount();
    expect(stop).toHaveBeenCalled();
  });
});
