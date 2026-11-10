import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getProfile, putProfile, userKeys, type UserProfile } from '@/api/user';

import EditProfile from './edit-profile';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getProfile: jest.fn(), putProfile: jest.fn() }));

const mockGet = jest.mocked(getProfile);
const mockPut = jest.mocked(putProfile);
const PROFILE: UserProfile = {
  userId: 'u1', email: 'sam@example.com', name: 'Sam', profilePhotoUrl: null, emailVerified: true,
  authProvider: 'EMAIL', timezone: 'Europe/London', createdAt: 'x',
};
const SAVED: UserProfile = { ...PROFILE, name: 'Sam K' };

let client: QueryClient;
async function renderScreen() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <EditProfile />
    </QueryClientProvider>,
  );
  await screen.findByLabelText('Name');
  return invalidate;
}
const typeName = async (v: string) => fireEvent.changeText(screen.getByLabelText('Name'), v);
const save = async () => fireEvent.press(screen.getByRole('button', { name: 'Save' }));
const apiError = (status: number, fieldErrors: { field: string; message: string }[] = []) =>
  new ApiError(status, 'bad', fieldErrors);

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(PROFILE);
  mockPut.mockResolvedValue(SAVED);
});

describe('Edit profile', () => {
  it('shows loading while the profile loads', async () => {
    mockGet.mockReturnValue(new Promise(() => undefined));
    await render(
      <QueryClientProvider client={new QueryClient()}>
        <EditProfile />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Loading profile')).toBeTruthy();
  });

  it('seeds the fields and disables Save until something changes', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('Sam');
    expect(screen.getByRole('button', { name: 'Timezone, Europe/London' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
    await save();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('saves only the name, updates the cache, invalidates tracking and closes', async () => {
    const invalidate = await renderScreen();
    await typeName('  Sam K ');
    await save();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith({ name: 'Sam K' });
    expect(client.getQueryData(userKeys.profile)).toEqual(SAVED);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tracking'] });
  });

  it('blocks a blank name without calling the API', async () => {
    await renderScreen();
    await typeName('   ');
    await save();
    expect(await screen.findByText('Enter your name')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('blocks 101 characters but allows 100', async () => {
    await renderScreen();
    await typeName('a'.repeat(101));
    await save();
    expect(await screen.findByText('Name must be 100 characters or fewer')).toBeTruthy();
    expect(mockPut).not.toHaveBeenCalled();
    await typeName('a'.repeat(100));
    await save();
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith({ name: 'a'.repeat(100) }));
  });

  it('picks a timezone by search and saves only the timezone', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Timezone, Europe/London' }));
    await fireEvent.changeText(screen.getByLabelText('Search timezones'), 'tokyo');
    expect(screen.queryByRole('button', { name: 'Europe/Paris' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Asia/Tokyo' }));
    expect(screen.getByRole('button', { name: 'Timezone, Asia/Tokyo' })).toBeTruthy();
    await save();
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith({ timezone: 'Asia/Tokyo' }));
  });

  it('shows an empty message when no timezone matches and goes back from the picker', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Timezone, Europe/London' }));
    await fireEvent.changeText(screen.getByLabelText('Search timezones'), 'zzzz');
    expect(screen.getByText('No timezones match')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to profile' }));
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('sends one request on a double tap', async () => {
    let resolve: (p: UserProfile) => void = () => undefined;
    mockPut.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    await typeName('Sam K');
    await save();
    await save();
    expect(mockPut).toHaveBeenCalledTimes(1);
    resolve(SAVED);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows a 400 field error inline and keeps what was typed', async () => {
    mockPut.mockRejectedValue(apiError(400, [{ field: 'name', message: 'must not be blank' }]));
    await renderScreen();
    await typeName('Sam K');
    await save();
    expect(await screen.findByText('must not be blank')).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Sam K');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows an offline banner on save and keeps the typed values', async () => {
    mockPut.mockRejectedValue(new NetworkError());
    await renderScreen();
    await typeName('Sam K');
    await save();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Sam K');
  });

  it('says the account is gone on a 404', async () => {
    mockPut.mockRejectedValue(apiError(404));
    await renderScreen();
    await typeName('Sam K');
    await save();
    expect(await screen.findByText('This account no longer exists.')).toBeTruthy();
  });

  it('shows a generic banner on a server error', async () => {
    mockPut.mockRejectedValue(apiError(500));
    await renderScreen();
    await typeName('Sam K');
    await save();
    expect(await screen.findByText("Couldn't save your profile. Try again.")).toBeTruthy();
  });

  it('shows a load error with Retry', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(PROFILE);
    await render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditProfile />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Name')).toBeTruthy();
  });

  it('closes with the Close button', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
