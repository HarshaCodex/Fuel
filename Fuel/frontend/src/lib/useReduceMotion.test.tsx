import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

let listener: (on: boolean) => void = () => {};
const remove = jest.fn();

beforeEach(() => {
  remove.mockClear();
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_n: string, cb: (on: boolean) => void) => {
    listener = cb;
    return { remove };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe('useReduceMotion', () => {
  it('is false until the OS answers, then true when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('stays false when Reduce Motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('follows the setting when it is toggled live, both ways', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    await act(async () => listener(true));
    expect(result.current).toBe(true);
    await act(async () => listener(false));
    expect(result.current).toBe(false);
  });

  it('falls back to false when the setting cannot be read', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(new Error('no'));
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('stops listening on unmount and ignores an answer that arrives late', async () => {
    let resolve!: (v: boolean) => void;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
    expect(result.current).toBe(false);
  });
});
