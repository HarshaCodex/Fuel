import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { createEntry, deleteEntry, trackingKeys } from '@/api/tracking';
import { foodKeys, getFoodPage, getRecentFoods, type Food, type FoodPage, type RecentFood } from '@/api/food';

import { hapticLight } from '@/lib/haptics';

import QuickLog from '../../app/quick-log';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: { focus?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/QuickLogSheet', () => ({
  QuickLogSheet: ({ onClose, children }: { onClose: () => void; children: (c: () => void) => unknown }) => children(onClose),
}));
jest.mock('@/api/food', () => ({
  ...jest.requireActual('@/api/food'),
  getRecentFoods: jest.fn(),
  getFoodPage: jest.fn(),
}));

jest.mock('@/api/tracking', () => ({
  ...jest.requireActual('@/api/tracking'),
  createEntry: jest.fn(),
  deleteEntry: jest.fn(),
}));
jest.mock('@/lib/haptics', () => ({ hapticLight: jest.fn() }));

const mockCreate = jest.mocked(createEntry);
const mockDelete = jest.mocked(deleteEntry);
const mockRecent = jest.mocked(getRecentFoods);
const mockPage = jest.mocked(getFoodPage);
const food = (id: string, name = `Food ${id}`, source: Food['source'] = 'USDA'): Food => ({
  id,
  name,
  brand: null,
  source,
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
});
const page = (content: Food[], p = 0, totalPages = 1): FoodPage => ({
  content,
  page: p,
  size: 20,
  totalElements: content.length,
  totalPages,
});
const RECENT: RecentFood = { ...food('f1', 'Chicken breast'), lastLoggedAt: '2026-11-08T12:00:00Z' };

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <QuickLog />
    </QueryClientProvider>,
  );
}
const typeText = async (value: string) => fireEvent.changeText(screen.getByLabelText('Search foods'), value);
const settle = async (ms: number) => {
  await act(async () => jest.advanceTimersByTime(ms));
  await act(async () => jest.advanceTimersByTime(1));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockParams = {};
  mockRecent.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

describe('Quick Log browse state', () => {
  it('shows the search field and three tiles that route', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Search foods').props.maxLength).toBe(100);
    expect(screen.getByLabelText('Search foods').props.returnKeyType).toBe('search');
    await fireEvent.press(screen.getByRole('button', { name: 'Scan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Manual' }));
    await fireEvent.press(screen.getByRole('button', { name: 'My Foods' }));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(['/scan', '/manual-entry', '/my-foods']);
  });

  it('shows three skeleton rows while recents load', async () => {
    mockRecent.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByLabelText('Loading recent foods')).toBeTruthy();
    expect(screen.getAllByTestId('recent-skeleton-row')).toHaveLength(3);
  });

  it('requests five recents and lists them with macros and chip', async () => {
    mockRecent.mockResolvedValue([RECENT, { ...food('f2', 'Oat bowl', 'USER'), lastLoggedAt: '2026-11-08T12:00:00Z' }]);
    await renderScreen();
    await settle(1);
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(mockRecent).toHaveBeenCalledWith(5);
    expect(screen.getAllByText('100 g · P 31 · C 0 · F 3.6')).toHaveLength(2);
    expect(screen.queryByText('Packaged')).toBeNull();
    expect(screen.getByText('Yours')).toBeTruthy();
  });

  it('hides the Recent section when there are none', async () => {
    await renderScreen();
    await settle(1);
    expect(screen.queryByText('Recent')).toBeNull();
    expect(screen.queryByLabelText('Loading recent foods')).toBeNull();
  });

  it('seeds the cache and opens food detail when a recent is tapped', async () => {
    mockRecent.mockResolvedValue([RECENT]);
    await renderScreen();
    await settle(1);
    await fireEvent.press(screen.getByLabelText('Chicken breast, 100 g, 165 kcal'));
    expect(client.getQueryData(foodKeys.detail('f1'))).toEqual(RECENT);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food-detail', params: { id: 'f1' } });
  });

  it('shows a retryable error and keeps the tiles working', async () => {
    mockRecent.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await renderScreen();
    await settle(1);
    expect(screen.getByText("Couldn't load recents")).toBeTruthy();
    mockRecent.mockResolvedValueOnce([RECENT]);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(1);
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.queryByText("Couldn't load recents")).toBeNull();
  });

  it('says so when offline', async () => {
    mockRecent.mockRejectedValue(new NetworkError());
    await renderScreen();
    await settle(1);
    expect(screen.getByText("You're offline. Recent foods aren't available.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manual' })).toBeTruthy();
  });

  it('closes with the Close button', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Quick Log typing state', () => {
  it('stays on browse and sends nothing for 1 character or spaces', async () => {
    await renderScreen();
    await typeText('a');
    await settle(400);
    await typeText('   ');
    await settle(400);
    expect(mockPage).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeTruthy();
  });

  it('swaps tiles and recents for results and back on clear', async () => {
    mockRecent.mockResolvedValue([RECENT]);
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await settle(1);
    await typeText('chicken');
    await settle(301);
    expect(screen.getByText('Chicken')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull();
    expect(screen.queryByText('Chicken breast')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('button', { name: 'Scan' })).toBeTruthy();
    expect(screen.getByText('Chicken breast')).toBeTruthy();
  });

  it('keeps the same search input mounted through typing and clearing', async () => {
    mockRecent.mockResolvedValue([RECENT]);
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await settle(1);
    const before = screen.getByLabelText('Search foods');
    await typeText('chicken');
    await settle(301);
    expect(screen.getByLabelText('Search foods')).toBe(before);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search foods')).toBe(before);
  });

  it('sends one request for rapid typing after the debounce', async () => {
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await typeText('ch');
    await settle(100);
    await typeText('chi');
    await settle(100);
    await typeText('chic');
    await settle(297);
    expect(mockPage).not.toHaveBeenCalled();
    await settle(3);
    expect(mockPage).toHaveBeenCalledTimes(1);
    expect(mockPage.mock.calls[0][0]).toBe('chic');
  });

  it('seeds the cache and opens the food on tap', async () => {
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await typeText('chicken');
    await settle(301);
    await fireEvent.press(screen.getByText('Chicken'));
    expect(client.getQueryData(foodKeys.detail('1'))).toMatchObject({ id: '1' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food-detail', params: { id: '1' } });
  });

  it('ignores a stale response for an older query', async () => {
    let resolveOld: (p: FoodPage) => void = () => {};
    mockPage.mockImplementation((q) =>
      q === 'old' ? new Promise((r) => (resolveOld = r)) : Promise.resolve(page([food('2', 'New result')])),
    );
    await renderScreen();
    await typeText('old');
    await settle(301);
    await typeText('new');
    await settle(301);
    await act(async () => resolveOld(page([food('1', 'Old result')])));
    expect(screen.getByText('New result')).toBeTruthy();
    expect(screen.queryByText('Old result')).toBeNull();
  });

  it('appends page 2 without duplicates and stops on the last page', async () => {
    mockPage.mockImplementation(async (_q, p = 0) =>
      p === 0 ? page([food('1'), food('2')], 0, 2) : page([food('2'), food('3')], 1, 2),
    );
    await renderScreen();
    await typeText('food');
    await settle(301);
    const list = screen.getByTestId('search-list');
    await act(async () => list.props.onEndReached());
    await settle(1);
    expect(mockPage).toHaveBeenCalledTimes(2);
    expect(mockPage.mock.calls[1][1]).toBe(1);
    expect(screen.getAllByText(/^Food \d$/)).toHaveLength(3);
    await act(async () => list.props.onEndReached());
    expect(mockPage).toHaveBeenCalledTimes(2);
  });

  it('shows a skeleton only after 200 ms of loading', async () => {
    mockPage.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await typeText('chicken');
    await settle(301);
    expect(screen.queryAllByTestId('search-skeleton-row')).toHaveLength(0);
    await settle(200);
    expect(screen.getAllByTestId('search-skeleton-row').length).toBeGreaterThan(0);
  });

  it('offers manual entry with the query and barcode when nothing matches', async () => {
    mockPage.mockResolvedValue(page([], 0, 0));
    await renderScreen();
    await typeText(' zzzz ');
    await settle(301);
    expect(screen.getByText("No match for 'zzzz'")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enter it manually' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    expect(mockPush).toHaveBeenNthCalledWith(1, { pathname: '/manual-entry', params: { name: 'zzzz' } });
    expect(mockPush).toHaveBeenNthCalledWith(2, '/scan');
  });

  it('shows an error, keeps the query and retries', async () => {
    mockPage.mockRejectedValueOnce(new ApiError(429, 'Too many requests')).mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await typeText('chicken');
    await settle(301);
    expect(screen.getByText("Couldn't search")).toBeTruthy();
    expect(screen.getByLabelText('Search foods').props.value).toBe('chicken');
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(1);
    expect(screen.getByText('Chicken')).toBeTruthy();
  });

  it('uses offline wording for a network error', async () => {
    mockPage.mockRejectedValue(new NetworkError());
    await renderScreen();
    await typeText('chicken');
    await settle(301);
    expect(screen.getByText("You're offline")).toBeTruthy();
  });

  it('keeps the list when page 2 fails and retries just that page', async () => {
    mockPage
      .mockResolvedValueOnce(page([food('1'), food('2')], 0, 2))
      .mockRejectedValueOnce(new ApiError(429, 'Too many requests'))
      .mockResolvedValue(page([food('3')], 1, 2));
    await renderScreen();
    await typeText('food');
    await settle(301);
    const list = screen.getByTestId('search-list');
    await act(async () => list.props.onEndReached());
    await settle(1);
    expect(screen.getByText("Couldn't load more")).toBeTruthy();
    expect(screen.getAllByText(/^Food \d$/)).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(1);
    expect(screen.getAllByText(/^Food \d$/)).toHaveLength(3);
  });

  it('fires only one next-page request while one is in flight', async () => {
    mockPage.mockResolvedValueOnce(page([food('1')], 0, 3)).mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await typeText('food');
    await settle(301);
    const list = screen.getByTestId('search-list');
    await act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
    });
    expect(mockPage).toHaveBeenCalledTimes(2);
  });
});

describe('Quick Log one-tap add', () => {
  const created = (id: string) => ({ id }) as Awaited<ReturnType<typeof createEntry>>;
  beforeEach(() => {
    jest.setSystemTime(new Date(2026, 10, 15, 8, 0));
    mockRecent.mockResolvedValue([RECENT, { ...food('f2', 'Rice'), lastLoggedAt: '2026-11-08T12:00:00Z' }]);
  });

  it('logs one serving under the meal for the hour, without navigating, and shows a toast', async () => {
    mockCreate.mockResolvedValue(created('e1'));
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    expect(mockCreate).toHaveBeenCalledWith({ foodId: 'f1', servingSize: 100, servingUnit: 'g', quantity: 1, mealLabel: 'breakfast' });
    expect(screen.getByText('Added to Breakfast · 165 kcal')).toBeTruthy();
    expect(screen.getByLabelText('Added Chicken breast')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    await settle(1500);
    expect(screen.getByLabelText('Log Chicken breast, 100 g')).toBeTruthy();
    await settle(3600);
    expect(screen.queryByText(/^Added to/)).toBeNull();
  });

  it('sends one entry when the button is double tapped', async () => {
    let resolve: (v: ReturnType<typeof created>) => void = () => {};
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    await settle(0);
    const btn = screen.getByLabelText('Log Chicken breast, 100 g');
    await fireEvent.press(btn);
    await fireEvent.press(btn);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => resolve(created('e1')));
  });

  it('undoes the newest entry after a second log replaced the toast', async () => {
    mockCreate.mockResolvedValueOnce(created('e1')).mockResolvedValueOnce(created('e2'));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Rice, 100 g'));
    await settle(0);
    expect(screen.getAllByText(/^Added to/)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await settle(0);
    expect(mockDelete).toHaveBeenCalledWith('e2');
    expect(screen.queryByText(/^Added to/)).toBeNull();
  });

  it('shows a Retry toast when undo fails', async () => {
    mockCreate.mockResolvedValue(created('e1'));
    mockDelete.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(null);
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await settle(0);
    expect(screen.getByText("Couldn't undo. Try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(0);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Couldn't undo. Try again.")).toBeNull();
  });

  it('shows an offline error toast, does not mark the row added, and retries', async () => {
    mockCreate.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(created('e1'));
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    expect(screen.getByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByLabelText('Added Chicken breast')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(0);
    expect(screen.getByText('Added to Breakfast · 165 kcal')).toBeTruthy();
  });

  it('uses the food-detail wording for a 404', async () => {
    mockCreate.mockRejectedValue(new ApiError(404, 'gone'));
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    expect(screen.getByText('That food is no longer available')).toBeTruthy();
  });

  it('has no "+" on search results', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Apple')]));
    await renderScreen();
    await typeText('apple');
    await settle(300);
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.queryByLabelText(/^Log Apple/)).toBeNull();
  });

  it('invalidates Today and buzzes once after a log and once after Undo, not after a failed log', async () => {
    mockCreate.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(created('e1'));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: trackingKeys.all });
    expect(hapticLight).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await settle(0);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
    expect(hapticLight).toHaveBeenCalledTimes(1);
    invalidate.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await settle(0);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
    expect(hapticLight).toHaveBeenCalledTimes(2);
  });

  it('calls delete once on a double tap of Undo and treats a 404 as done', async () => {
    mockCreate.mockResolvedValue(created('e1'));
    let reject: (e: unknown) => void = () => {};
    mockDelete.mockReturnValue(new Promise((_, r) => (reject = r)));
    await renderScreen();
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await settle(0);
    const undoBtn = screen.getByRole('button', { name: 'Undo' });
    await fireEvent.press(undoBtn);
    await fireEvent.press(undoBtn);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    await act(async () => reject(new ApiError(404, 'gone')));
    await settle(0);
    expect(screen.queryByText("Couldn't undo. Try again.")).toBeNull();
    expect(screen.queryByText(/^Added to/)).toBeNull();
  });

  it('still logs and refreshes Today when the sheet closes mid-request', async () => {
    let resolve: (v: ReturnType<typeof created>) => void = () => {};
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await settle(0);
    await fireEvent.press(screen.getByLabelText('Log Chicken breast, 100 g'));
    await screen.unmount();
    await act(async () => resolve(created('e1')));
    await settle(6000);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
  });
});
