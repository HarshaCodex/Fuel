import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { createCustomFood, foodKeys, type Food } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';

import ManualEntry from './manual-entry';

const mockDismissAll = jest.fn();
const mockBack = jest.fn();
let mockParams: { mode?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissAll: mockDismissAll, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), createCustomFood: jest.fn() }));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), createEntry: jest.fn() }));

const mockCreate = jest.mocked(createCustomFood);
const mockEntry = jest.mocked(createEntry);

const saved: Food = {
  id: 'c1', name: 'Oats', brand: null, source: 'USER', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3,
};

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <ManualEntry />
    </QueryClientProvider>,
  );
}
const type = async (label: string, v: string) => fireEvent.changeText(screen.getByLabelText(label), v);
const fillValid = async () => {
  await type('Name', ' Oats ');
  await type('Serving size', '40');
  await type('Calories', '150');
  await type('Protein', '5');
  await type('Carbs', '27');
  await type('Fat', '3');
};
const press = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
  mockCreate.mockResolvedValue(saved);
  mockEntry.mockResolvedValue({} as never);
});
afterEach(() => jest.restoreAllMocks());

describe('Manual entry screen', () => {
  it('creates the food then logs its own serving, and refreshes caches', async () => {
    await renderScreen();
    const spy = jest.spyOn(client, 'invalidateQueries');
    await fillValid();
    await press('Log food');
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Oats', brand: null, servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3,
    });
    expect(mockEntry).toHaveBeenCalledWith({ foodId: 'c1', servingSize: 40, servingUnit: 'g', quantity: 1, mealLabel: 'breakfast' });
    expect(spy).toHaveBeenCalledWith({ queryKey: foodKeys.custom });
    expect(spy).toHaveBeenCalledWith({ queryKey: trackingKeys.all });
  });

  it('saves without logging', async () => {
    await renderScreen();
    await fillValid();
    await press('Save to My Foods only');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockEntry).not.toHaveBeenCalled();
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it('create mode has one Save food button', async () => {
    mockParams = { mode: 'create' };
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Log food' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save to My Foods only' })).toBeNull();
    await fillValid();
    await press('Save food');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockEntry).not.toHaveBeenCalled();
  });

  it('blocks a negative number and shows the message without calling the API', async () => {
    await renderScreen();
    await fillValid();
    await type('Calories', '-5');
    await press('Log food');
    expect(screen.getByText('Enter a number, 0 or more')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows errors on blur, not while typing', async () => {
    await renderScreen();
    await type('Calories', '-');
    expect(screen.queryByText('Enter a number, 0 or more')).toBeNull();
    await fireEvent(screen.getByLabelText('Calories'), 'blur');
    expect(screen.getByText('Enter a number, 0 or more')).toBeTruthy();
  });

  it('puts API field errors next to their fields', async () => {
    mockCreate.mockRejectedValue(new ApiError(400, 'Validation failed', [{ field: 'name', message: 'Name already used' }]));
    await renderScreen();
    await fillValid();
    await press('Log food');
    expect(await screen.findByText('Name already used')).toBeTruthy();
    expect(screen.queryByText('Check the details and try again.')).toBeNull();
    expect(mockEntry).not.toHaveBeenCalled();
  });

  it('shows a general banner for a field the screen lacks', async () => {
    mockCreate.mockRejectedValue(new ApiError(400, 'Validation failed', [{ field: 'barcode', message: 'bad' }]));
    await renderScreen();
    await fillValid();
    await press('Log food');
    expect(await screen.findByText('Check the details and try again.')).toBeTruthy();
  });

  it('keeps typed values offline and retries on the button', async () => {
    mockCreate.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    await fillValid();
    await press('Log food');
    expect(await screen.findByText(/You're offline/)).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe(' Oats ');
    expect(screen.getByLabelText('Calories').props.value).toBe('150');
    await press('Log food');
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('retries only the log when the entry fails after the food was created', async () => {
    mockEntry.mockRejectedValueOnce(new ApiError(500, 'boom', []));
    await renderScreen();
    await fillValid();
    await press('Log food');
    expect(await screen.findByText(/Saved to My Foods, but couldn't log it/)).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe(' Oats ');
    await press('Retry');
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockEntry).toHaveBeenCalledTimes(2);
    expect(mockEntry).toHaveBeenLastCalledWith(expect.objectContaining({ foodId: 'c1' }));
  });

  it('ignores a second tap while saving', async () => {
    let release: (f: Food) => void = () => {};
    mockCreate.mockReturnValue(new Promise<Food>((r) => (release = r)));
    await renderScreen();
    await fillValid();
    await press('Log food');
    await press('Log food');
    release(saved);
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('goes back at once when nothing was typed', async () => {
    await renderScreen();
    await press('Back');
    expect(mockBack).toHaveBeenCalled();
  });

  it('asks before discarding a dirty form', async () => {
    await renderScreen();
    await type('Name', 'Oats');
    await press('Back');
    expect(screen.getByText('Discard this food?')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await press('Keep editing');
    expect(screen.queryByText('Discard this food?')).toBeNull();
    await press('Back');
    await press('Discard');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('hints when macros do not match calories', async () => {
    await renderScreen();
    await type('Calories', '100');
    await type('Protein', '50');
    await type('Carbs', '0');
    await type('Fat', '0');
    expect(screen.getByText('Macros add up to about 200 kcal')).toBeTruthy();
  });

  it('sends brand and fiber when given and the chosen unit', async () => {
    await renderScreen();
    await fillValid();
    await type('Brand (optional)', 'Quaker');
    await type('Fiber (optional)', '4');
    await fireEvent.press(screen.getByRole('radio', { name: 'cup' }));
    await press('Log food');
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ brand: 'Quaker', fiber: 4, servingUnit: 'cup' }));
  });
});
