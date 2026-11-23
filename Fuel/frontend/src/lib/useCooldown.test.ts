import { act, renderHook } from '@testing-library/react-native';

import { formatCooldown, useCooldown } from './useCooldown';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('formatCooldown', () => {
  it('formats m:ss', () => {
    expect(formatCooldown(45)).toBe('0:45');
    expect(formatCooldown(5)).toBe('0:05');
    expect(formatCooldown(90)).toBe('1:30');
    expect(formatCooldown(-1)).toBe('0:00');
  });
});

describe('useCooldown', () => {
  it('counts down per second to zero and stops', async () => {
    const { result } = await renderHook(() => useCooldown(3));
    const cleared = jest.spyOn(globalThis, 'clearInterval');
    expect(result.current.remaining).toBe(3);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(2);
    await act(async () => jest.advanceTimersByTime(5000));
    expect(result.current.remaining).toBe(0);
    expect(cleared).toHaveBeenCalled();
  });

  it('restarts with start()', async () => {
    const { result } = await renderHook(() => useCooldown(0));
    expect(result.current.remaining).toBe(0);
    await act(async () => result.current.start(10));
    expect(result.current.remaining).toBe(10);
  });

  it('does not drift when time jumps (backgrounded)', async () => {
    const { result } = await renderHook(() => useCooldown(45));
    await act(async () => jest.advanceTimersByTime(30000));
    expect(result.current.remaining).toBe(15);
  });

  it('clears the interval on unmount', async () => {
    const cleared = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderHook(() => useCooldown(45));
    expect(cleared).not.toHaveBeenCalled();
    await unmount();
    expect(cleared).toHaveBeenCalledTimes(1);
  });
});
