import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getBodyStats, putBodyStats, userKeys, type BodyStats } from '@/api/user';

import EditBodyStats from '../../app/edit-body-stats';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getBodyStats: jest.fn(), putBodyStats: jest.fn() }));

const mockGet = jest.mocked(getBodyStats);
const mockPut = jest.mocked(putBodyStats);
const STATS: BodyStats = { height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 30, gender: 'MALE', activityLevel: 'MODERATE', updatedAt: 'x' };

let client: QueryClient;
async function renderScreen(ready = 'Age') {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <EditBodyStats />
    </QueryClientProvider>,
  );
  await screen.findByLabelText(ready);
}
const type = async (label: string, v: string) => fireEvent.changeText(screen.getByLabelText(label), v);
const save = async () => fireEvent.press(screen.getByRole('button', { name: 'Save' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(STATS);
  mockPut.mockResolvedValue({ ...STATS, age: 31 });
});

describe('Edit body stats', () => {
  it('shows loading text before data arrives', async () => {
    mockGet.mockReturnValue(new Promise(() => undefined));
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <EditBodyStats />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading body stats')).toBeTruthy();
  });

  it('seeds the fields from saved stats', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Age').props.value).toBe('30');
    expect(screen.getByLabelText('Height (cm)').props.value).toBe('180');
    expect(screen.getByLabelText('Weight (kg)').props.value).toBe('80');
    expect(screen.getByRole('radio', { name: /^Moderately active/ }).props.accessibilityState.selected).toBe(true);
  });

  it('starts blank when nothing is saved', async () => {
    mockGet.mockResolvedValue(null);
    await renderScreen();
    expect(screen.getByLabelText('Age').props.value).toBe('');
    await save();
    expect(await screen.findByText('Enter your age')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('shows a retry banner and no Save when loading fails', async () => {
    mockGet.mockRejectedValue(new NetworkError());
    await render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditBodyStats />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('does not overwrite typing when stats refetch', async () => {
    await renderScreen();
    await type('Age', '41');
    mockGet.mockResolvedValue({ ...STATS, age: 55 });
    await client.refetchQueries({ queryKey: userKeys.bodyStats });
    expect(screen.getByLabelText('Age').props.value).toBe('41');
  });

  it('blocks an invalid age without calling the API', async () => {
    await renderScreen();
    await type('Age', '10');
    await save();
    expect(await screen.findByText('Age must be a whole number from 13 to 120')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('saves, updates the cache and goes back', async () => {
    await renderScreen();
    await type('Age', '31');
    mockGet.mockResolvedValue({ ...STATS, age: 31 }); // the invalidation refetch sees the saved values
    await save();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith({
      height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 31, gender: 'MALE', activityLevel: 'MODERATE',
    });
    expect((client.getQueryData(userKeys.bodyStats) as BodyStats).age).toBe(31);
  });

  it('converts to imperial and sends feet and pounds', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Imperial' }));
    expect(screen.getByLabelText('Weight (lbs)').props.value).toBe('176.4');
    await type('Height (ft)', '6');
    await type('Height (in)', '0');
    await type('Weight (lbs)', '180');
    await save();
    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ height: 6, heightUnit: 'ft', weight: 180, weightUnit: 'lbs' }));
  });

  it('changes the activity level', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /^Very active/ }));
    await save();
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ activityLevel: 'VERY_ACTIVE' })));
  });

  it('sends one request on a double press', async () => {
    let finish: (s: BodyStats) => void = () => undefined;
    mockPut.mockReturnValue(new Promise<BodyStats>((resolve) => { finish = resolve; }));
    await renderScreen();
    await save();
    await save();
    expect(mockPut).toHaveBeenCalledTimes(1);
    await act(async () => finish(STATS));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it('shows a 400 field error beside the field and keeps typed values', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'bad', [{ field: 'weight', message: 'Too heavy' }]));
    await renderScreen();
    await type('Age', '33');
    await save();
    expect(await screen.findByText('Too heavy')).toBeTruthy();
    expect(screen.getByLabelText('Age').props.value).toBe('33');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the generic banner for an unmapped 400', async () => {
    mockPut.mockRejectedValue(new ApiError(400, 'bad', [{ field: 'other', message: 'x' }]));
    await renderScreen();
    await save();
    expect(await screen.findByText('Some details were not accepted. Check your answers and try again.')).toBeTruthy();
  });

  it('keeps values and says offline when the network fails', async () => {
    mockPut.mockRejectedValue(new NetworkError());
    await renderScreen();
    await type('Age', '44');
    await save();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Age').props.value).toBe('44');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the generic banner for a server error', async () => {
    mockPut.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    await save();
    expect(await screen.findByText("Couldn't save your body stats. Try again.")).toBeTruthy();
  });

  it('closes without saving', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });
});
