import { act, renderHook } from '@testing-library/react-native';

import { motion } from '@/theme';

import { useCountUp } from './useCountUp';

// Frames are driven by hand: each advance moves the clock and runs the queued frame.
let now = 0;
let queued: (() => void) | null = null;
const advance = (ms: number) =>
  act(() => {
    now += ms;
    const cb = queued;
    queued = null;
    cb?.();
  });

beforeEach(() => {
  now = 1000;
  queued = null;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((cb: () => void) => {
    queued = cb;
    return 1;
  }) as never);
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((() => {
    queued = null;
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe('useCountUp', () => {
  it('shows the first value at once, with no animation', async () => {
    const { result } = await renderHook(() => useCountUp(750, false));
    expect(result.current).toBe(750);
    expect(queued).toBeNull();
  });

  it('counts up to a new target over 400ms and lands exactly on it', async () => {
    expect(motion.slow).toBe(400);
    const { result, rerender } = await renderHook<number, { t: number }>(({ t }) => useCountUp(t, false), { initialProps: { t: 0 } });
    await rerender({ t: 1000 });
    await advance(100);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1000);
    await advance(300);
    expect(result.current).toBe(1000);
  });

  it('restarts from the value on screen when the target changes mid-count', async () => {
    const { result, rerender } = await renderHook<number, { t: number }>(({ t }) => useCountUp(t, false), { initialProps: { t: 0 } });
    await rerender({ t: 1000 });
    await advance(100);
    const mid = result.current;
    expect(mid).toBeGreaterThan(0);
    await rerender({ t: 200 });
    await advance(10);
    // Moved from mid toward 200, not from 0 and not jumping to 200.
    expect(result.current).toBeLessThanOrEqual(mid);
    expect(result.current).toBeGreaterThan(200);
    await advance(400);
    expect(result.current).toBe(200);
  });

  it('returns the target at once when Reduce Motion is on, and starts no frames', async () => {
    const { result, rerender } = await renderHook<number, { t: number }>(({ t }) => useCountUp(t, true), { initialProps: { t: 0 } });
    await rerender({ t: 900 });
    expect(result.current).toBe(900);
    expect(queued).toBeNull();
  });

  it('jumps when Reduce Motion is switched on mid-count', async () => {
    const { result, rerender } = await renderHook<number, { t: number; r: boolean }>(({ t, r }) => useCountUp(t, r), { initialProps: { t: 0, r: false } });
    await rerender({ t: 1000, r: false });
    await advance(50);
    await rerender({ t: 1000, r: true });
    expect(result.current).toBe(1000);
  });

  it('cancels its frame on unmount', async () => {
    const { rerender, unmount } = await renderHook<number, { t: number }>(({ t }) => useCountUp(t, false), { initialProps: { t: 0 } });
    await rerender({ t: 500 });
    expect(queued).not.toBeNull();
    await unmount();
    expect(queued).toBeNull();
  });
});

describe('useCountUp startAt', () => {
  it('starts at startAt and reaches the target after 400ms', async () => {
    const { result } = await renderHook(() => useCountUp(100, false, 0));
    expect(result.current).toBe(0);
    await advance(motion.slow);
    expect(result.current).toBe(100);
  });
});
