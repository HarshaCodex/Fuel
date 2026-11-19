import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { getProfile, userKeys, type UserProfile } from '@/api/user';

import { useToday } from './useToday';

jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getProfile: jest.fn() }));
jest.mock('@/lib/timezones', () => ({ ...jest.requireActual('@/lib/timezones'), deviceTimezone: () => 'UTC' }));
const mockProfile = jest.mocked(getProfile);

const profile = (timezone: string) => ({ timezone }) as UserProfile;

async function setup(tz = 'America/Los_Angeles') {
  mockProfile.mockResolvedValue(profile(tz));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const view = await renderHook(() => useToday(), { wrapper });
  await waitFor(() => expect(qc.getQueryData(userKeys.profile)).toBeDefined());
  await act(async () => void jest.advanceTimersByTime(10)); // let React Query notify the hook
  invalidate.mockClear();
  return { ...view, qc, invalidate };
}

let onChange: ((s: string) => void) | undefined;
const remove = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-19T20:00:00Z')); // 12:00 in LA, Nov 19
  remove.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    onChange = cb;
    return { remove };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useToday', () => {
  it('uses the profile timezone over the phone one', async () => {
    jest.setSystemTime(new Date('2026-11-20T03:00:00Z')); // Nov 20 in UTC, Nov 19 in LA
    const { result } = await setup();
    expect(result.current).toBe('2026-11-19');
  });

  it('moves on when the app returns to the foreground after midnight, and refetches once', async () => {
    const { result, invalidate } = await setup();
    expect(result.current).toBe('2026-11-19');
    jest.setSystemTime(new Date('2026-11-20T09:00:00Z'));
    await act(async () => onChange?.('active'));
    expect(result.current).toBe('2026-11-20');
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tracking'] });
  });

  it('does not refetch when the app comes back on the same day', async () => {
    const { result, invalidate } = await setup();
    jest.setSystemTime(new Date('2026-11-19T22:00:00Z'));
    await act(async () => onChange?.('active'));
    expect(result.current).toBe('2026-11-19');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('updates from the timer when midnight passes with the app open', async () => {
    jest.setSystemTime(new Date('2026-11-20T07:59:50Z')); // 23:59:50 in LA
    const { result, invalidate } = await setup();
    expect(result.current).toBe('2026-11-19');
    await act(async () => void jest.advanceTimersByTime(12_000));
    expect(result.current).toBe('2026-11-20');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the profile timezone changes', async () => {
    jest.setSystemTime(new Date('2026-11-19T12:00:00Z')); // 04:00 Nov 19 in LA, 01:00 Nov 20 in Auckland
    const { result, qc, invalidate } = await setup('America/Los_Angeles');
    expect(result.current).toBe('2026-11-19');
    await act(async () => {
      qc.setQueryData(userKeys.profile, profile('Pacific/Auckland'));
      jest.advanceTimersByTime(10);
    });
    expect(result.current).toBe('2026-11-20');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('removes the listener and clears the midnight timer on unmount', async () => {
    jest.setSystemTime(new Date('2026-11-20T07:59:50Z'));
    const set = jest.spyOn(globalThis, 'setTimeout');
    const { unmount } = await setup();
    const midnight = set.mock.results[set.mock.calls.findLastIndex(([, ms]) => ms === 11_000)]?.value;
    expect(midnight).toBeDefined();
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    await unmount();
    expect(remove).toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith(midnight);
  });

  it('reschedules the midnight timer after it fires', async () => {
    jest.setSystemTime(new Date('2026-11-20T07:59:50Z')); // 23:59:50 in LA
    const { result } = await setup();
    await act(async () => void jest.advanceTimersByTime(12_000));
    expect(result.current).toBe('2026-11-20');
    await act(async () => void jest.advanceTimersByTime(24 * 3600 * 1000));
    expect(result.current).toBe('2026-11-21');
  });
});
