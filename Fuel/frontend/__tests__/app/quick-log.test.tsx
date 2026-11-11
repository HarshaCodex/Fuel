import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getRecentFoods, type RecentFood } from '@/api/food';

import QuickLog from '../../app/quick-log';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), getRecentFoods: jest.fn() }));

const mockRecent = jest.mocked(getRecentFoods);
const RECENT: RecentFood = {
  id: 'f1',
  name: 'Chicken breast',
  brand: null,
  source: 'USDA',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  lastLoggedAt: '2026-11-08T12:00:00Z',
};

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <QueryClientProvider client={client}>
        <QuickLog />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('Quick Log menu', () => {
  it('shows the four methods and routes each one', async () => {
    mockRecent.mockResolvedValue([]);
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enter manually' }));
    await fireEvent.press(screen.getByRole('button', { name: 'My Foods' }));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual(['/search', '/scan', '/manual-entry', '/my-foods']);
  });

  it('shows three skeleton rows while recents load', async () => {
    mockRecent.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByLabelText('Loading recent foods')).toBeTruthy();
    expect(screen.getAllByTestId('recent-skeleton-row')).toHaveLength(3);
  });

  it('requests five recents and lists them', async () => {
    mockRecent.mockResolvedValue([RECENT]);
    await renderScreen();
    expect(await screen.findByText('Chicken breast')).toBeTruthy();
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(mockRecent).toHaveBeenCalledWith(5);
    expect(screen.queryByLabelText('Loading recent foods')).toBeNull();
  });

  it('hides the Recent section when there are none', async () => {
    mockRecent.mockResolvedValue([]);
    await renderScreen();
    await waitFor(() => expect(screen.queryByLabelText('Loading recent foods')).toBeNull());
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('seeds the cache and opens food detail when a recent is tapped', async () => {
    mockRecent.mockResolvedValue([RECENT]);
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Chicken breast, 100 g, 165 calories, USDA Verified'));
    expect(client.getQueryData(foodKeys.detail('f1'))).toEqual(RECENT);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food-detail', params: { id: 'f1' } });
  });

  it('shows a retryable error and keeps the methods working', async () => {
    mockRecent.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load recents")).toBeTruthy();
    mockRecent.mockResolvedValueOnce([RECENT]);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Chicken breast')).toBeTruthy();
    expect(screen.queryByText("Couldn't load recents")).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('says so when offline', async () => {
    mockRecent.mockRejectedValue(new NetworkError());
    await renderScreen();
    expect(await screen.findByText("You're offline. Recent foods aren't available.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter manually' })).toBeTruthy();
  });

  it('closes with the Close button', async () => {
    mockRecent.mockResolvedValue([]);
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
