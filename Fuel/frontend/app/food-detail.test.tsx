import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFood, type Food } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';

import FoodDetail from './food-detail';

const mockDismissAll = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissAll: mockDismissAll, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'f1' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), getFood: jest.fn() }));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), createEntry: jest.fn() }));

const mockGetFood = jest.mocked(getFood);
const mockCreate = jest.mocked(createEntry);

const chicken: Food = {
  id: 'f1',
  name: 'Chicken breast',
  brand: 'Farm Co',
  source: 'USDA',
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
};

let client: QueryClient;
async function renderScreen(food: Food | null = chicken) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (food) client.setQueryData(foodKeys.detail('f1'), food);
  await render(
    <QueryClientProvider client={client}>
      <FoodDetail />
    </QueryClientProvider>,
  );
}
const amount = async (v: string) => fireEvent.changeText(screen.getByLabelText(/^Amount/), v);
const logButton = () => screen.getByRole('button', { name: /^Log / });
const selectedMeal = () =>
  screen.getAllByRole('radio').find((r) => r.props.accessibilityState?.selected)?.props.accessibilityLabel;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
});
afterEach(() => jest.restoreAllMocks());

describe('Food detail screen', () => {
  it('shows the food, its default serving and live macros', async () => {
    await renderScreen();
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.getByText('Farm Co')).toBeTruthy();
    expect(screen.getByLabelText('Amount').props.value).toBe('100');
    expect(screen.getByRole('button', { name: 'Log 165 kcal' })).toBeTruthy();
    await amount('150');
    expect(screen.getByRole('button', { name: 'Log 248 kcal' })).toBeTruthy();
    expect(screen.getByText('248 kcal')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    expect(screen.getByRole('button', { name: 'Log 371 kcal' })).toBeTruthy();
  });

  it('omits the brand line when brand is null', async () => {
    await renderScreen({ ...chicken, brand: null });
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.queryByText('Farm Co')).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('shows and sends a non-gram unit', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen({ ...chicken, servingSize: 1, servingUnit: 'cup', calories: 200 });
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByText('cup')).toBeTruthy();
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ servingSize: 1, servingUnit: 'cup', quantity: 1 });
  });

  it.each([
    ['', true],
    ['0', true],
    ['1.55', true],
    ['abc', true],
    ['150', false],
    ['0.5', false],
  ])('amount "%s" disabled=%s', async (text, disabled) => {
    await renderScreen();
    await amount(text);
    expect(logButton().props.accessibilityState.disabled).toBe(disabled);
  });

  it('shows a field error after blur for an invalid amount and none for a valid one', async () => {
    await renderScreen();
    await amount('abc');
    expect(screen.queryByText(/Enter an amount above 0/)).toBeNull();
    await fireEvent(screen.getByLabelText(/^Amount/), 'blur');
    expect(screen.getByText(/Enter an amount above 0/)).toBeTruthy();
    await amount('12');
    expect(screen.queryByText(/Enter an amount above 0/)).toBeNull();
  });

  it('does not send when the amount is invalid', async () => {
    await renderScreen();
    await amount('0');
    await fireEvent.press(logButton());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('stops the quantity at 0.5', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Quantity' }));
    expect(screen.getByText('0.5')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decrease Quantity' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease Quantity' }));
    expect(screen.getByText('0.5')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log 83 kcal' })).toBeTruthy();
  });

  it.each([
    [9, 'Breakfast'],
    [11, 'Lunch'],
    [15, 'Snack'],
    [17, 'Dinner'],
  ])('preselects the meal for hour %s', async (hour, label) => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour);
    await renderScreen();
    expect(selectedMeal()).toBe(label);
  });

  it('sends the chosen meal, amount and quantity, then refreshes Today and closes', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await amount('150');
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toEqual({
      foodId: 'f1',
      servingSize: 150,
      servingUnit: 'g',
      quantity: 1.5,
      mealLabel: 'dinner',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
    expect(invalidate.mock.invocationCallOrder[0]).toBeLessThan(mockDismissAll.mock.invocationCallOrder[0]);
  });

  it('sends one POST when Log is tapped repeatedly', async () => {
    let resolve!: (v: never) => void;
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    await fireEvent.press(logButton());
    await fireEvent.press(logButton());
    await fireEvent.press(logButton());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => resolve({} as never));
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['400', new ApiError(400, 'Serving size is too large'), 'Serving size is too large'],
    ['404', new ApiError(404, 'Food not found'), 'That food is no longer available'],
    ['offline', new NetworkError(), "You're offline. Check your connection and try again."],
  ])('keeps inputs and shows a banner on %s, and Retry resends', async (_n, error, message) => {
    mockCreate.mockRejectedValueOnce(error);
    await renderScreen();
    await amount('150');
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    await fireEvent.press(logButton());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount').props.value).toBe('150');
    expect(selectedMeal()).toBe('Snack');
    expect(screen.getByText('1.5')).toBeTruthy();

    mockCreate.mockResolvedValueOnce({} as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0]).toEqual(mockCreate.mock.calls[0][0]);
  });

  it('falls back to GET /food/{id} when the cache is empty', async () => {
    mockGetFood.mockResolvedValue(chicken);
    await renderScreen(null);
    expect(await screen.findByText('Chicken breast')).toBeTruthy();
    expect(mockGetFood).toHaveBeenCalledWith('f1');
  });

  it('shows not found with Go back when the food is gone', async () => {
    mockGetFood.mockRejectedValue(new ApiError(404, 'nope'));
    await renderScreen(null);
    expect(await screen.findByText('Food not found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an offline load error and retries', async () => {
    mockGetFood.mockRejectedValueOnce(new NetworkError());
    await renderScreen(null);
    expect(await screen.findByText("You're offline")).toBeTruthy();
    mockGetFood.mockResolvedValueOnce(chicken);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Chicken breast')).toBeTruthy();
  });
});
