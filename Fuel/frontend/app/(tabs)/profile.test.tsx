import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { NetworkError } from '@/api/errors';
import { getBodyStats, getGoals, getProfile, userKeys, type BodyStats, type Goals, type UserProfile } from '@/api/user';

import Profile from './profile';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getGoals: jest.fn(), getProfile: jest.fn(), getBodyStats: jest.fn() }));


const mockGet = jest.mocked(getGoals);
const mockProfile = jest.mocked(getProfile);
const mockBody = jest.mocked(getBodyStats);
const BODY: BodyStats = { height: 180, heightUnit: 'cm', weight: 80.5, weightUnit: 'kg', age: 30, gender: 'MALE', activityLevel: 'MODERATE', updatedAt: 'x' };
const PROFILE: UserProfile = {
  userId: 'u1', email: 'sam@example.com', name: 'sam k', profilePhotoUrl: null, emailVerified: true,
  authProvider: 'EMAIL', timezone: 'Europe/London', createdAt: '2026-11-01T00:00:00Z',
};
const GOALS: Goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70.5, isAutoCalculated: false, updatedAt: '2026-11-01T00:00:00Z' };

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Profile />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.mockResolvedValue(PROFILE);
  mockBody.mockResolvedValue(BODY);
  mockGet.mockResolvedValue(GOALS);
});

describe('Profile body stats card', () => {
  it('shows loading, then the saved stats, and opens the editor', async () => {
    await renderScreen();
    expect(screen.getByText('Loading body stats')).toBeTruthy();
    expect(await screen.findByText('180 cm, 80.5 kg, 30 years, Male')).toBeTruthy();
    expect(screen.getByText('Moderately active')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Edit body stats/ }));
    expect(mockPush).toHaveBeenCalledWith('/edit-body-stats');
  });

  it('invites the user to add stats when none are saved', async () => {
    mockBody.mockResolvedValue(null);
    await renderScreen();
    const add = await screen.findByRole('button', { name: 'Add your body stats' });
    await fireEvent.press(add);
    expect(mockPush).toHaveBeenCalledWith('/edit-body-stats');
  });

  it('shows an offline banner with Retry when loading fails', async () => {
    mockBody.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit body stats' }).props.accessibilityState.disabled).toBe(true);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry' })));
    expect(await screen.findByText('180 cm, 80.5 kg, 30 years, Male')).toBeTruthy();
  });
});

describe('Profile goals card', () => {
  it('shows loading, then formatted goals set by the user', async () => {
    mockGet.mockResolvedValue(GOALS);
    await renderScreen();
    expect(screen.getByText('Loading goals')).toBeTruthy();
    expect(await screen.findByText('2,200 kcal')).toBeTruthy();
    expect(screen.getByText('Protein 150 g, Carbs 250 g, Fat 70.5 g')).toBeTruthy();
    expect(screen.getByText('Set by you')).toBeTruthy();
  });

  it('notes auto-calculated goals', async () => {
    mockGet.mockResolvedValue({ ...GOALS, isAutoCalculated: true });
    await renderScreen();
    expect(await screen.findByText('Calculated from your body stats')).toBeTruthy();
  });

  it('flags default targets when never updated', async () => {
    mockGet.mockResolvedValue({ ...GOALS, updatedAt: null });
    await renderScreen();
    expect(await screen.findByText('Default targets. Set yours')).toBeTruthy();
  });

  it('opens the edit modal when the card is pressed', async () => {
    mockGet.mockResolvedValue(GOALS);
    await renderScreen();
    await screen.findByText('2,200 kcal');
    await fireEvent.press(screen.getByRole('button', { name: /^Edit goals/ }));
    expect(mockPush).toHaveBeenCalledWith('/edit-goals');
  });

  it('shows an offline message with Retry that refetches', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(GOALS);
    await renderScreen();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('2,200 kcal')).toBeTruthy();
  });

  it('cannot be pressed while there is no data', async () => {
    mockGet.mockRejectedValue(new Error('x'));
    await renderScreen();
    await screen.findByText("Couldn't load your goals.");
    await fireEvent.press(screen.getByRole('button', { name: 'Edit goals' }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens My Foods from its row', async () => {
    mockGet.mockResolvedValue(GOALS);
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'My Foods' }));
    expect(mockPush).toHaveBeenCalledWith('/my-foods');
  });
});

describe('Profile account card', () => {
  it('shows loading, then the name, email, timezone and initial', async () => {
    mockGet.mockResolvedValue(GOALS);
    await renderScreen();
    expect(screen.getByText('Loading profile')).toBeTruthy();
    expect(await screen.findByText('sam k')).toBeTruthy();
    expect(screen.getByText('sam@example.com')).toBeTruthy();
    expect(screen.getByText('Europe/London')).toBeTruthy();
    expect(screen.getByText('S', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the new name when the profile cache is updated after an edit', async () => {
    mockGet.mockResolvedValue(GOALS);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <Profile />
      </QueryClientProvider>,
    );
    await screen.findByText('sam k');
    await act(async () => client.setQueryData(userKeys.profile, { ...PROFILE, name: 'Alex', timezone: 'Asia/Tokyo' }));
    expect(await screen.findByText('Alex')).toBeTruthy();
    expect(screen.getByText('Asia/Tokyo')).toBeTruthy();
  });

  it('opens the edit profile modal', async () => {
    mockGet.mockResolvedValue(GOALS);
    await renderScreen();
    await screen.findByText('sam k');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });

  it('shows an offline message with Retry that refetches the profile', async () => {
    mockGet.mockResolvedValue(GOALS);
    mockProfile.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(PROFILE);
    await renderScreen();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('sam k')).toBeTruthy();
  });

  it('shows a load error without an edit button', async () => {
    mockGet.mockResolvedValue(GOALS);
    mockProfile.mockRejectedValue(new Error('x'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your profile.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
  });
});
