import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteEntry, type DashboardEntry } from '@/api/tracking';

import { UNDO_MS, usePendingDeletes } from './usePendingDeletes';

jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), deleteEntry: jest.fn() }));
const mockDelete = jest.mocked(deleteEntry);

const entry = (id: string): DashboardEntry => ({
  id, foodName: id, source: 'USDA', mealLabel: null, calories: 1, protein: 1, carbs: 1, fat: 1, loggedAt: '2026-11-09T08:00:00Z',
});

async function setup() {
  const onError = jest.fn();
  const qc = new QueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const view = await renderHook(() => usePendingDeletes(onError), { wrapper });
  return { ...view, onError, invalidate };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockDelete.mockReset().mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

describe('usePendingDeletes', () => {
  it('hides the row at once and waits for the timer before calling the server', async () => {
    const { result } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    expect(result.current.ids.has('a')).toBe(true);
    expect(result.current.last?.id).toBe('a');
    await act(async () => void jest.advanceTimersByTime(UNDO_MS - 1));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes on the timer, refreshes the dashboard, then forgets the id', async () => {
    const { result, invalidate } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => void jest.advanceTimersByTime(UNDO_MS));
    expect(mockDelete).toHaveBeenCalledWith('a');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tracking'] });
    expect(result.current.ids.size).toBe(0);
    expect(result.current.last).toBeNull();
  });

  it('undo cancels the delete and brings the row back', async () => {
    const { result } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => void result.current.undo());
    expect(result.current.ids.size).toBe(0);
    expect(result.current.last).toBeNull();
    await act(async () => void jest.advanceTimersByTime(UNDO_MS * 2));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('sends the first delete at once when a second is scheduled', async () => {
    const { result } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => result.current.schedule(entry('b')));
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith('a');
    expect(result.current.last?.id).toBe('b');
    await act(async () => void jest.advanceTimersByTime(UNDO_MS));
    expect(mockDelete).toHaveBeenCalledWith('b');
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  it.each([new ApiError(500, 'boom'), new NetworkError()])('restores the row and reports the error (%#)', async (error) => {
    mockDelete.mockRejectedValue(error);
    const { result, onError } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => void jest.advanceTimersByTime(UNDO_MS));
    expect(result.current.ids.size).toBe(0);
    expect(onError).toHaveBeenCalledWith(error, expect.objectContaining({ id: 'a' }));
  });

  it('flush sends pending deletes now', async () => {
    const { result } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => result.current.flush());
    expect(mockDelete).toHaveBeenCalledWith('a');
    await act(async () => void jest.advanceTimersByTime(UNDO_MS * 2));
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('sends pending deletes when the screen unmounts', async () => {
    const { result, unmount } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => unmount());
    expect(mockDelete).toHaveBeenCalledWith('a');
  });

  it('sends pending deletes when the app leaves the foreground', async () => {
    let listener: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
      listener = fn;
      return { remove: jest.fn() };
    }) as never);
    const { result } = await setup();
    await act(async () => void result.current.schedule(entry('a')));
    await act(async () => listener('active'));
    expect(mockDelete).not.toHaveBeenCalled();
    await act(async () => listener('background'));
    expect(mockDelete).toHaveBeenCalledWith('a');
  });
});
