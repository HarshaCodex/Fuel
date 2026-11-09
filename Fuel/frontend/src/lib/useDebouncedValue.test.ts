import { act, renderHook } from '@testing-library/react-native';

import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebouncedValue', () => {
  it('starts with the initial value', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  it('emits only the last value after the delay', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    await rerender({ v: 'ab' });
    await act(async () => jest.advanceTimersByTime(200));
    await rerender({ v: 'abc' });
    await act(async () => jest.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    await act(async () => jest.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});
