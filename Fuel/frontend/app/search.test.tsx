import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFoodPage, type Food, type FoodPage } from '@/api/food';

import Search from './search';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), getFoodPage: jest.fn() }));

const mockPage = jest.mocked(getFoodPage);
const food = (id: string, name = `Food ${id}`): Food => ({
  id,
  name,
  brand: null,
  source: 'USDA',
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

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <Search />
    </QueryClientProvider>,
  );
}
const type = async (value: string) => fireEvent.changeText(screen.getByLabelText('Search foods'), value);
const settle = async (ms: number) => {
  await act(async () => jest.advanceTimersByTime(ms));
  await act(async () => jest.advanceTimersByTime(1));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('Search screen', () => {
  it('shows the idle hint and sends nothing for 1 character or spaces', async () => {
    await renderScreen();
    expect(screen.getByText('Type at least 2 characters to search foods.')).toBeTruthy();
    await type('a');
    await settle(400);
    await type('   ');
    await settle(400);
    expect(mockPage).not.toHaveBeenCalled();
  });

  it('sends one request for rapid typing after the debounce', async () => {
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await type('ch');
    await settle(100);
    await type('chi');
    await settle(100);
    await type('chic');
    await settle(297);
    expect(mockPage).not.toHaveBeenCalled();
    await settle(3);
    expect(mockPage).toHaveBeenCalledTimes(1);
    expect(mockPage.mock.calls[0][0]).toBe('chic');
    expect(screen.getByText('Chicken')).toBeTruthy();
  });

  it('seeds the cache and opens the food on tap', async () => {
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await type('chicken');
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
    await type('old');
    await settle(301);
    await type('new');
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
    await type('food');
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
    await type('chicken');
    await settle(301);
    expect(screen.queryAllByTestId('search-skeleton-row')).toHaveLength(0);
    await settle(200);
    expect(screen.getAllByTestId('search-skeleton-row').length).toBeGreaterThan(0);
  });

  it('offers manual entry with the query and barcode when nothing matches', async () => {
    mockPage.mockResolvedValue(page([], 0, 0));
    await renderScreen();
    await type(' zzzz ');
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
    await type('chicken');
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
    await type('chicken');
    await settle(301);
    expect(screen.getByText("You're offline")).toBeTruthy();
  });

  it('clears back to idle', async () => {
    mockPage.mockResolvedValue(page([food('1', 'Chicken')]));
    await renderScreen();
    await type('chicken');
    await settle(301);
    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Type at least 2 characters to search foods.')).toBeTruthy();
    expect(screen.queryByText('Chicken')).toBeNull();
  });

  it('goes back from the Back button', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the list when page 2 fails and retries just that page', async () => {
    mockPage
      .mockResolvedValueOnce(page([food('1'), food('2')], 0, 2))
      .mockRejectedValueOnce(new ApiError(429, 'Too many requests'))
      .mockResolvedValue(page([food('3')], 1, 2));
    await renderScreen();
    await type('food');
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
    await type('food');
    await settle(301);
    const list = screen.getByTestId('search-list');
    await act(async () => {
      list.props.onEndReached();
      list.props.onEndReached();
    });
    expect(mockPage).toHaveBeenCalledTimes(2);
  });
});
