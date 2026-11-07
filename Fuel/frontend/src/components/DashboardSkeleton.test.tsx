import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { DashboardSkeleton } from './DashboardSkeleton';

describe('DashboardSkeleton', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is one progress element labelled "Loading your day"', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(<DashboardSkeleton />);
    expect(screen.getByRole('progressbar', { name: 'Loading your day' })).toBeOnTheScreen();
  });

  it('pulses by default and stops the loop on unmount', async () => {
    const stop = jest.fn();
    const start = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(Animated, 'loop').mockReturnValue({ start, stop, reset: jest.fn() });
    const { unmount } = await render(<DashboardSkeleton />);
    expect(start).toHaveBeenCalled();
    await act(async () => unmount());
    expect(stop).toHaveBeenCalled();
  });

  it('stops the loop once Reduce Motion is read as on, and starts no new one', async () => {
    const stop = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    await render(<DashboardSkeleton />);
    await act(async () => {});
    expect(loop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
