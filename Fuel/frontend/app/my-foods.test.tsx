import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteCustomFood, foodKeys, getCustomFoodPage, type Food, type FoodPage } from '@/api/food';

import MyFoods from './my-foods';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
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

beforeEach(() => jest.clearAllMocks());

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

  it('deletes after confirming and shows the empty state for the last row', async () => {
    mockPage.mockResolvedValueOnce(page([food('a', 'Oat bowl')])).mockResolvedValue(page([]));
    mockDelete.mockResolvedValue(null);
    await renderScreen();
    await openDelete('Oat bowl');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Foods you create show up here')).toBeTruthy();
    expect(mockDelete).toHaveBeenCalledWith('a');
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
