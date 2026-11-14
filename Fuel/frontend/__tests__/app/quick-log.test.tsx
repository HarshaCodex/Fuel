import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFoodPage, getRecentFoods, type Food, type FoodPage, type RecentFood } from '@/api/food';

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
