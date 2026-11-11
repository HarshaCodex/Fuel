import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getGoals, putGoals, userKeys, type Goals } from '@/api/user';

import EditGoals from '../../app/edit-goals';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getGoals: jest.fn(), putGoals: jest.fn() }));

const mockGet = jest.mocked(getGoals);
const mockPut = jest.mocked(putGoals);
const GOALS: Goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70, isAutoCalculated: false, updatedAt: 'x' };
const SAVED: Goals = { ...GOALS, calorieGoal: 2000, isAutoCalculated: false };

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <EditGoals />
    </QueryClientProvider>,
  );
  await screen.findByLabelText('Calories');
}
const type = async (label: string, v: string) => fireEvent.changeText(screen.getByLabelText(label), v);
const save = async () => fireEvent.press(screen.getByRole('button', { name: 'Save' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(GOALS);
  mockPut.mockResolvedValue(SAVED);
});

describe('Edit goals', () => {
  it('shows loading, then seeds the fields', async () => {
    mockGet.mockReturnValue(new Promise(() => undefined));
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <EditGoals />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading goals')).toBeTruthy();
  });

  it('seeds the fields from the loaded goals', async () => {
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <EditGoals />
      </QueryClientProvider>,
    );
    expect((await screen.findByLabelText('Protein (g)')).props.value).toBe('150');
    expect(screen.getByLabelText('Calories').props.value).toBe('2200');
  });

  it('shows a retry banner and no Save when loading fails', async () => {
    mockGet.mockRejectedValue(new NetworkError());
    await render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditGoals />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('does not overwrite typing when goals refetch', async () => {
    await renderScreen();
    await type('Calories', '1900');
    mockGet.mockResolvedValue({ ...GOALS, calorieGoal: 3000 });
    await client.refetchQueries({ queryKey: userKeys.goals });
    expect(screen.getByLabelText('Calories').props.value).toBe('1900');
  });

  it('shows a success line at exactly 100 percent', async () => {
    await renderScreen();
    expect(screen.getByText('= 101% of your calories')).toBeTruthy(); // 2230 of 2200 kcal
    await type('Calories', '2230');
    expect(screen.getByText('= 100% of your calories')).toBeTruthy();
  });

  it('shows a caution percent and hides it for invalid input', async () => {
    await renderScreen();
    await type('Calories', '3000');
    expect(screen.getByText('= 74% of your calories')).toBeTruthy();
    await type('Fat (g)', 'abc');
    expect(screen.queryByText(/of your calories/)).toBeNull();
  });

  it('makes no API call for invalid input and shows field errors', async () => {
    await renderScreen();
    await type('Calories', '100');
    await save();
    expect(await screen.findByText('Calories must be a whole number from 800 to 10000')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('saves, updates the cache and goes back', async () => {
    await renderScreen();
    await type('Calories', '2000');
    mockGet.mockResolvedValue(SAVED); // the invalidation refetch sees the saved values
    await save();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith({ calorieGoal: 2000, proteinGoal: 150, carbGoal: 250, fatGoal: 70 });
    expect(client.getQueryData(userKeys.goals)).toEqual(SAVED);
  });

  it('sends one request on a double press', async () => {
    let finish: (g: Goals) => void = () => undefined;
    mockPut.mockReturnValue(new Promise<Goals>((resolve) => { finish = resolve; }));
    await renderScreen();
    await save();
    await save();
    expect(mockPut).toHaveBeenCalledTimes(1);
    await act(async () => finish(SAVED));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('shows a 400 field error beside the field and keeps typed values', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'bad', [{ field: 'fatGoal', message: 'Too much fat' }]));
    await renderScreen();
    await type('Calories', '2100');
    await save();
    expect(await screen.findByText('Too much fat')).toBeTruthy();
    expect(screen.getByLabelText('Calories').props.value).toBe('2100');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the generic validation banner for an unmapped 400', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'bad', [{ field: 'other', message: 'x' }]));
    await renderScreen();
    await save();
    expect(await screen.findByText('Some details were not accepted. Check your answers and try again.')).toBeTruthy();
  });

  it('keeps values and says offline when the network fails', async () => {
    mockPut.mockRejectedValue(new NetworkError());
    await renderScreen();
    await type('Protein (g)', '120');
    await save();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Protein (g)').props.value).toBe('120');
  });

  it('shows a rate limit message on 429', async () => {
    mockPut.mockRejectedValue(new ApiError(429, 'slow', [], 120));
    await renderScreen();
    await save();
    expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
  });

  it('shows a generic error otherwise', async () => {
    mockPut.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    await save();
    expect(await screen.findByText("Couldn't save your goals. Try again.")).toBeTruthy();
  });

  it('closes without saving', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });
});
