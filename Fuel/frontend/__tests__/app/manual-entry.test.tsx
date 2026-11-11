import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { createCustomFood, foodKeys, getFood, updateCustomFood, type Food } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';

import ManualEntry from '../../app/manual-entry';

const mockDismissAll = jest.fn();
const mockBack = jest.fn();
let mockBackWhilePrevented: boolean[] = [];
let mockPrevent = false;
let mockBlocked: ((o: { data: { action: unknown }; repeat: () => void }) => void) | undefined;
const mockRepeat = jest.fn();
let mockParams: { mode?: string; id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({
    dismissAll: mockDismissAll,
    back: (...a: unknown[]) => {
      mockBackWhilePrevented.push(mockPrevent);
      return mockBack(...a);
    },
  }),
  useLocalSearchParams: () => mockParams,
  usePreventRemove: (prevent: boolean, cb: typeof mockBlocked) => {
    mockPrevent = prevent;
    mockBlocked = cb;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/api/food', () => ({
  ...jest.requireActual('@/api/food'),
  createCustomFood: jest.fn(),
  updateCustomFood: jest.fn(),
  getFood: jest.fn(),
}));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), createEntry: jest.fn() }));

const mockCreate = jest.mocked(createCustomFood);
const mockEntry = jest.mocked(createEntry);
const mockUpdate = jest.mocked(updateCustomFood);
const mockGetFood = jest.mocked(getFood);

/** What the navigator does on Android back or iOS swipe-back: when prevention is on it calls the hook back. */
const leave = () => {
  if (!mockPrevent) return false;
  mockBlocked?.({ data: { action: { type: 'GO_BACK' } }, repeat: mockRepeat });
  return true;
};

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
  mockBackWhilePrevented = [];
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
    // Going back while still protected would raise the discard dialog for a food that was just saved.
    expect(mockBackWhilePrevented).toEqual([false]);
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
    expect(mockBackWhilePrevented).toEqual([false]);
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

  it('retry after a failed save-only does not log', async () => {
    mockCreate.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    await fillValid();
    await press('Save to My Foods only');
    expect(await screen.findByText(/You're offline/)).toBeTruthy();
    await press('Retry');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockEntry).not.toHaveBeenCalled();
  });

  it('guards against two submits fired in the same batch', async () => {
    let release: (f: Food) => void = () => {};
    mockCreate.mockReturnValue(new Promise<Food>((r) => (release = r)));
    await renderScreen();
    await fillValid();
    const logPress = screen.getByRole('button', { name: 'Log food' });
    const savePress = screen.getByRole('button', { name: 'Save to My Foods only' });
    await act(async () => {
      fireEvent.press(logPress);
      fireEvent.press(savePress);
    });
    release(saved);
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Done on the last field logs', async () => {
    await renderScreen();
    await fillValid();
    await fireEvent(screen.getByLabelText('Fiber (optional)'), 'submitEditing');
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    expect(mockEntry).toHaveBeenCalledTimes(1);
  });

  it('Done on the last field saves only in create mode', async () => {
    mockParams = { mode: 'create' };
    await renderScreen();
    await fillValid();
    await fireEvent(screen.getByLabelText('Fiber (optional)'), 'submitEditing');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockEntry).not.toHaveBeenCalled();
  });

  it('shows offline as caution and other failures as danger', async () => {
    mockCreate.mockRejectedValueOnce(new ApiError(500, 'boom', []));
    await renderScreen();
    await fillValid();
    await press('Log food');
    expect(await screen.findByText("Couldn't save this food. Try again.")).toBeTruthy();
    expect(screen.getByText("Couldn't save this food. Try again.").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#B42318' })]),
    );
  });

  it('goes back at once when nothing was typed', async () => {
    await renderScreen();
    await press('Back');
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets a clean form leave without asking', async () => {
    await renderScreen();
    expect(mockPrevent).toBe(false);
  });

  it('asks before discarding a dirty form, however the user leaves', async () => {
    await renderScreen();
    await type('Name', 'Oats');
    expect(mockPrevent).toBe(true);
    await act(async () => leave());
    expect(screen.getByText('Discard this food?')).toBeTruthy();
    expect(mockRepeat).not.toHaveBeenCalled();
    await press('Keep editing');
    expect(screen.queryByText('Discard this food?')).toBeNull();
    await act(async () => leave());
    await press('Discard');
    expect(mockRepeat).toHaveBeenCalledTimes(1);
  });

  it('does not ask once the food is saved', async () => {
    await renderScreen();
    await fillValid();
    await press('Save to My Foods only');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockPrevent).toBe(false);
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

describe('Manual entry screen, edit mode', () => {
  beforeEach(() => {
    mockParams = { id: 'c1' };
    mockUpdate.mockResolvedValue({ ...saved, name: 'Oats 2' });
  });

  it('prefills from the cache, saves the full body and goes back', async () => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(foodKeys.detail('c1'), { ...saved, brand: 'Quaker', fiber: 4 });
    mockGetFood.mockResolvedValue(saved);
    await render(
      <QueryClientProvider client={client}>
        <ManualEntry />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Edit food')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Oats');
    expect(screen.getByLabelText('Brand (optional)').props.value).toBe('Quaker');
    expect(screen.queryByRole('button', { name: 'Log food' })).toBeNull();
    // A clean prefilled form does not ask before leaving.
    expect(mockPrevent).toBe(false);
    await type('Name', 'Oats 2');
    await press('Save changes');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockBackWhilePrevented).toEqual([false]);
    expect(mockUpdate).toHaveBeenCalledWith('c1', {
      name: 'Oats 2', brand: 'Quaker', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect((client.getQueryData(foodKeys.detail('c1')) as Food).name).toBe('Oats 2');
    expect(mockPrevent).toBe(false);
  });

  it('fetches the food when it is not cached', async () => {
    mockGetFood.mockResolvedValue(saved);
    await renderScreen();
    expect(await screen.findByDisplayValue('Oats')).toBeTruthy();
    expect(mockGetFood).toHaveBeenCalledWith('c1');
  });

  it('says so when the food to edit is gone', async () => {
    mockGetFood.mockRejectedValue(new ApiError(404, 'gone'));
    await renderScreen();
    expect(await screen.findByText('This food no longer exists')).toBeTruthy();
  });

  it('shows a banner without Retry when saving hits a 404', async () => {
    mockGetFood.mockResolvedValue(saved);
    mockUpdate.mockRejectedValue(new ApiError(404, 'gone'));
    await renderScreen();
    await screen.findByDisplayValue('Oats');
    await type('Name', 'Oats 2');
    await press('Save changes');
    expect(await screen.findByText('This food no longer exists.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('puts API field errors next to their fields when saving', async () => {
    mockGetFood.mockResolvedValue(saved);
    mockUpdate.mockRejectedValue(new ApiError(400, 'bad', [{ field: 'name', message: 'Name is taken' }]));
    await renderScreen();
    await screen.findByDisplayValue('Oats');
    await type('Name', 'Oats 2');
    await press('Save changes');
    expect(await screen.findByText('Name is taken')).toBeTruthy();
  });
});
