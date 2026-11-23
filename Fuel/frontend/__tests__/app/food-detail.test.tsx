import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dimensions, Keyboard, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFood, type Food } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';

import { hapticLight, hapticSelect } from '@/lib/haptics';

import FoodDetail from '../../app/food-detail';

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

jest.mock('@/lib/haptics', () => ({ hapticLight: jest.fn(), hapticSelect: jest.fn() }));
const mockLight = jest.mocked(hapticLight);
const mockSelect = jest.mocked(hapticSelect);
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
const tile = (name: string | RegExp) => screen.getByRole('radio', { name });
const custom = async (v?: string) => {
  await fireEvent.press(tile(/^Custom/));
  if (v !== undefined) await fireEvent.changeText(screen.getByLabelText(/^Amount in/), v);
};
const logButton = () => screen.getByRole('button', { name: /^Log / });
const group = (name: string) => screen.getByLabelText(name);
const selectedIn = (name: string) =>
  within(group(name))
    .getAllByRole('radio')
    .find((r) => r.props.accessibilityState?.selected)?.props.accessibilityLabel;
const selectedMeal = () => selectedIn('Meal');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
});
afterEach(() => jest.restoreAllMocks());

describe('Food detail screen', () => {
  it('shows the title block, tiles with 1 serving selected, and the card', async () => {
    await renderScreen();
    expect(screen.getByText('Chicken breast')).toBeTruthy();
    expect(screen.getByText('Farm Co')).toBeTruthy();
    expect(screen.getByText('Verified · USDA FoodData Central')).toBeTruthy();
    expect(tile('50 g, ½ serving')).toBeTruthy();
    expect(tile('150 g, 1½ servings')).toBeTruthy();
    expect(selectedIn('Portion')).toBe('100 g, 1 serving');
    expect(screen.getByRole('button', { name: 'Log 165 kcal to Breakfast' })).toBeTruthy();
    expect(screen.getByLabelText('165 calories, protein 31 grams, carbs 0 grams, fat 3.6 grams')).toBeTruthy();
  });

  it.each([
    ['OFF', 'From the manufacturer label'],
    ['USER', 'Entered by you'],
  ] as const)('shows the %s source line', async (source, line) => {
    await renderScreen({ ...chicken, source });
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.queryByText(/Verified/)).toBeNull();
  });

  it('omits the brand line when brand is null', async () => {
    await renderScreen({ ...chicken, brand: null });
    expect(screen.queryByText('Farm Co')).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('updates the card and button when a tile is chosen, and sends that tile amount', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen();
    await fireEvent.press(tile('150 g, 1½ servings'));
    expect(screen.getByRole('button', { name: 'Log 248 kcal to Breakfast' })).toBeTruthy();
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ servingSize: 150, quantity: 1 });
  });

  it('shows and sends a non-gram unit with halves', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen({ ...chicken, servingSize: 1, servingUnit: 'cup', calories: 200 });
    expect(tile('½ cup, ½ serving')).toBeTruthy();
    expect(tile('1½ cup, 1½ servings')).toBeTruthy();
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ servingSize: 1, servingUnit: 'cup', quantity: 1 });
  });

  it('rounds a half tile to one decimal and sends the rounded value', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen({ ...chicken, servingSize: 2.5 });
    await fireEvent.press(tile(/^1.3 g/));
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].servingSize).toBe(1.3);
  });

  it('opens Custom prefilled with the current amount', async () => {
    await renderScreen();
    await fireEvent.press(tile('150 g, 1½ servings'));
    await custom();
    expect(screen.getByLabelText('Amount in g').props.value).toBe('150');
  });

  it('computes a custom amount live and sends it', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen();
    await custom('200');
    expect(screen.getByRole('button', { name: 'Log 330 kcal to Breakfast' })).toBeTruthy();
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ servingSize: 200, quantity: 1 });
  });

  it.each([
    ['', true],
    ['0', true],
    ['1.25', true],
    ['abc', true],
    ['1234567', true],
    ['175', false],
    ['0.5', false],
  ])('custom amount "%s" disabled=%s', async (text, disabled) => {
    await renderScreen();
    await custom(text);
    expect(logButton().props.accessibilityState.disabled).toBe(disabled);
  });

  it('falls back to one serving on the card while the custom text is invalid', async () => {
    await renderScreen();
    await fireEvent.press(tile('150 g, 1½ servings'));
    expect(screen.getByRole('button', { name: 'Log 248 kcal to Breakfast' })).toBeTruthy();
    await custom('abc');
    const button = screen.getByRole('button', { name: 'Log 165 kcal to Breakfast' });
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('hides the error banner while the custom amount is invalid so Retry is never a no-op', async () => {
    mockCreate.mockRejectedValueOnce(new ApiError(400, 'Serving size is too large'));
    await renderScreen();
    await custom('150');
    await fireEvent.press(logButton());
    await screen.findByText('Serving size is too large');
    await fireEvent.changeText(screen.getByLabelText(/^Amount in/), 'abc');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(/^Amount in/), '120');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('shrinks the calorie number while the keyboard is up', async () => {
    // The avoider and the card each subscribe, so keep every handler.
    const handlers: Record<string, ((e: unknown) => void)[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: (e: unknown) => void) => {
      (handlers[name] ??= []).push(fn);
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
    await renderScreen();
    const size = () => StyleSheet.flatten(screen.getByTestId('calorie-card-kcal').props.style).fontSize;
    const big = size();
    const windowHeight = Dimensions.get('window').height;
    const show = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    await act(async () =>
      handlers[show].forEach((fn) => fn({ endCoordinates: { height: 300, screenY: windowHeight - 300 } })),
    );
    expect(size()).toBeLessThan(big);
  });

  it('shows the amount error after blur and none for a valid one', async () => {
    await renderScreen();
    await custom('abc');
    expect(screen.queryByText(/Enter an amount above 0/)).toBeNull();
    await fireEvent(screen.getByLabelText(/^Amount in/), 'blur');
    expect(screen.getByText(/Enter an amount above 0/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(/^Amount in/), '12');
    expect(screen.queryByText(/Enter an amount above 0/)).toBeNull();
  });

  it('does not send when the custom amount is invalid', async () => {
    await renderScreen();
    await custom('0');
    await fireEvent.press(logButton());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('uses the tile amount again after switching back from Custom', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen();
    await custom('abc');
    await fireEvent.press(tile('50 g, ½ serving'));
    expect(screen.queryByLabelText(/^Amount in/)).toBeNull();
    await fireEvent.press(logButton());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].servingSize).toBe(50);
  });

  it('shows a bar-less card for an all-zero food without crashing', async () => {
    await renderScreen({ ...chicken, calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(screen.getByLabelText('0 calories, protein 0 grams, carbs 0 grams, fat 0 grams')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: `Log 165 kcal to ${label}` })).toBeTruthy();
  });

  it('gives a select haptic only when the portion or meal really changes', async () => {
    await renderScreen();
    await fireEvent.press(tile('100 g, 1 serving'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Breakfast' }));
    expect(mockSelect).not.toHaveBeenCalled();
    await fireEvent.press(tile('50 g, ½ serving'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('sends the chosen meal and amount, then refreshes Today and closes', async () => {
    mockCreate.mockResolvedValue({} as never);
    await renderScreen();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await fireEvent.press(tile('150 g, 1½ servings'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log 248 kcal to Dinner' }));
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0]).toEqual({
      foodId: 'f1',
      servingSize: 150,
      servingUnit: 'g',
      quantity: 1,
      mealLabel: 'dinner',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
    expect(invalidate.mock.invocationCallOrder[0]).toBeLessThan(mockDismissAll.mock.invocationCallOrder[0]);
  });

  it('gives one light haptic after a successful log, even if Log is tapped repeatedly', async () => {
    let resolve!: (v: never) => void;
    mockCreate.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    await fireEvent.press(logButton());
    await fireEvent.press(logButton());
    expect(mockLight).not.toHaveBeenCalled();
    await act(async () => resolve({} as never));
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalledTimes(1));
    expect(mockLight).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('gives no haptic when logging fails', async () => {
    mockCreate.mockRejectedValueOnce(new ApiError(400, 'Serving size is too large'));
    await renderScreen();
    await fireEvent.press(logButton());
    await screen.findByText('Serving size is too large');
    expect(mockLight).not.toHaveBeenCalled();
  });

  it.each([
    ['400', new ApiError(400, 'Serving size is too large'), 'Serving size is too large'],
    ['404', new ApiError(404, 'Food not found'), 'That food is no longer available'],
    ['offline', new NetworkError(), "You're offline. Check your connection and try again."],
  ])('keeps inputs and shows a banner on %s, and Retry resends', async (_n, error, message) => {
    mockCreate.mockRejectedValueOnce(error);
    await renderScreen();
    await custom('150');
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));
    await fireEvent.press(logButton());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Amount in g').props.value).toBe('150');
    expect(selectedMeal()).toBe('Snack');

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
