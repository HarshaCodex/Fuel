import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Platform } from 'react-native';
import { SwipeDirection } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteCustomFood, foodKeys, getCustomFoodPage, type Food, type FoodPage } from '@/api/food';

import MyFoods from '../../app/my-foods';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
// Gestures cannot run in Jest, so Swipeable is replaced by a stub that records its props for the tests to call.
const mockSwipes: Record<string, { onSwipeableOpen: (d: string) => void }> = {};
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { testID: string; children: unknown; onSwipeableOpen: (d: string) => void }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: () => {} }));
    mockSwipes[props.testID] = props;
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/api/food', () => ({
  ...jest.requireActual('@/api/food'),
  getCustomFoodPage: jest.fn(),
  deleteCustomFood: jest.fn(),
}));

const mockPage = jest.mocked(getCustomFoodPage);
const mockDelete = jest.mocked(deleteCustomFood);
const food = (id: string, name: string): Food => ({
  id,
  name,
  brand: null,
  source: 'USER',
  servingSize: 100,
  servingUnit: 'g',
  calories: 200,
  protein: 10,
  carbs: 20,
  fat: 5,
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
      <MyFoods />
    </QueryClientProvider>,
  );
}

async function openDelete(name: string) {
  await fireEvent.press(await screen.findByRole('button', { name: `More actions for ${name}` }));
  await fireEvent.press(screen.getByRole('button', { name: `Delete ${name}` }));
}

const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  // Android runs a menu choice at once; the iOS wait for onDismiss is tested in CustomFoodRow.test.tsx.
  Platform.OS = 'android';
});
afterEach(() => {
  Platform.OS = originalOS;
});

describe('My Foods', () => {
  it('shows a skeleton while loading', async () => {
    mockPage.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByLabelText('Loading My Foods')).toBeTruthy();
    expect(screen.getAllByTestId('my-foods-skeleton-row')).toHaveLength(4);
  });

  it('lists foods and requests size 20', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl'), food('b', 'Protein shake')]));
    await renderScreen();
    expect(await screen.findByText('Oat bowl')).toBeTruthy();
    expect(screen.getByText('Protein shake')).toBeTruthy();
    expect(mockPage).toHaveBeenCalledWith(0, 20);
  });

  it('explains how to add a food when empty', async () => {
    mockPage.mockResolvedValue(page([]));
    await renderScreen();
    expect(await screen.findByText('Foods you create show up here')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Enter a food' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/manual-entry', params: { mode: 'create' } });
  });

  it('opens New food in create mode', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    await renderScreen();
    await screen.findByText('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'New food' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/manual-entry', params: { mode: 'create' } });
  });

  it('shows an error with Retry, offline wording for network errors', async () => {
    mockPage.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(page([food('a', 'Oat bowl')]));
    await renderScreen();
    expect(await screen.findByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Oat bowl')).toBeTruthy();
  });

  it('shows a generic error for server failures', async () => {
    mockPage.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load My Foods")).toBeTruthy();
  });

  it('seeds the detail cache and opens the food on row tap', async () => {
    const oat = food('a', 'Oat bowl');
    mockPage.mockResolvedValue(page([oat]));
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText(/^Oat bowl, 100 g/));
    expect(client.getQueryData(foodKeys.detail('a'))).toEqual(oat);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/food-detail', params: { id: 'a' } });
  });

  it('loads the next page from totalPages', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl')], 0, 2)).mockResolvedValueOnce(page([food('b', 'Rice')], 1, 2));
    await renderScreen();
    await screen.findByText('Oat bowl');
    await fireEvent(screen.getByTestId('my-foods-list'), 'endReached');
    expect(await screen.findByText('Rice')).toBeTruthy();
    expect(mockPage).toHaveBeenLastCalledWith(1, 20);
  });

  it('cancelling the confirmation keeps the food and sends nothing', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    await renderScreen();
    await openDelete('Oat bowl');
    expect(screen.getByText('Delete Oat bowl?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Oat bowl')).toBeTruthy();
  });

  it('removes the row from the cache without waiting for the refetch', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl'), food('b', 'Rice')])).mockReturnValue(new Promise(() => {}));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Oat bowl')).toBeNull());
    expect(screen.getByText('Rice')).toBeTruthy();
    expect(mockDelete).toHaveBeenCalledWith('a');
    expect(client.getQueryData(foodKeys.detail('a'))).toBeUndefined();
  });

  it('shows the empty state after deleting the last row, whatever the refetch does', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl')])).mockReturnValue(new Promise(() => {}));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Foods you create show up here')).toBeTruthy();
  });

  it('ignores a second confirm tap while deleting', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    mockDelete.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await openDelete('Oat bowl');
    const confirm = screen.getByRole('button', { name: 'Delete' });
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('shows an offline banner when a refresh fails but data is loaded', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl')])).mockRejectedValue(new NetworkError());
    await renderScreen();
    await screen.findByText('Oat bowl');
    await act(async () => {
      await client.invalidateQueries({ queryKey: foodKeys.custom });
    });
    expect(await screen.findByText("You're offline. Showing what was loaded.")).toBeTruthy();
    expect(screen.getByText('Oat bowl')).toBeTruthy();
  });

  it('retries loading the next page after a failure', async () => {
    mockPage
      .mockResolvedValueOnce(page([food('a', 'Oat bowl')], 0, 2))
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValue(page([food('b', 'Rice')], 1, 2));
    await renderScreen();
    await screen.findByText('Oat bowl');
    await fireEvent(screen.getByTestId('my-foods-list'), 'endReached');
    expect(await screen.findByText("Couldn't load more")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Rice')).toBeTruthy();
  });

  it('keeps the row and shows a banner when delete fails', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    mockDelete.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText("Couldn't delete the food. Try again.")).toBeTruthy();
    expect(screen.getByText('Oat bowl')).toBeTruthy();
  });

  it('says so when delete fails offline', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    mockDelete.mockRejectedValue(new NetworkError());
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText("You're offline. The food wasn't deleted.")).toBeTruthy();
  });

  it('treats a 404 on delete as already removed', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl'), food('b', 'Rice')])).mockResolvedValue(page([food('b', 'Rice')]));
    mockDelete.mockRejectedValue(new ApiError(404, 'gone'));
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Oat bowl')).toBeNull());
    expect(screen.queryByText("Couldn't delete the food. Try again.")).toBeNull();
    expect(screen.getByText('Rice')).toBeTruthy();
  });
});

describe('My Foods edit and swipe', () => {
  it('menu Edit seeds the cache and opens the editor with the id', async () => {
    const oat = food('a', 'Oat bowl');
    mockPage.mockResolvedValue(page([oat]));
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'More actions for Oat bowl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Oat bowl' }));
    expect(client.getQueryData(foodKeys.detail('a'))).toEqual(oat);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/manual-entry', params: { id: 'a' } });
  });

  it('swipe right opens the editor', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    await renderScreen();
    await screen.findByText('Oat bowl');
    await act(async () => mockSwipes['swipe-a'].onSwipeableOpen(SwipeDirection.RIGHT));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/manual-entry', params: { id: 'a' } });
  });

  it('swipe left asks to confirm, and cancelling deletes nothing', async () => {
    mockPage.mockResolvedValue(page([food('a', 'Oat bowl')]));
    await renderScreen();
    await screen.findByText('Oat bowl');
    await act(async () => mockSwipes['swipe-a'].onSwipeableOpen(SwipeDirection.LEFT));
    expect(screen.getByText('Delete Oat bowl?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Oat bowl')).toBeTruthy();
  });

  it('swipe left then confirm deletes', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl')])).mockReturnValue(new Promise(() => {}));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    await screen.findByText('Oat bowl');
    await act(async () => mockSwipes['swipe-a'].onSwipeableOpen(SwipeDirection.LEFT));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('a'));
  });
});
