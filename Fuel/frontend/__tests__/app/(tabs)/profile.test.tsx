import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { NetworkError } from '@/api/errors';
import { getCustomFoodPage } from '@/api/food';
import { deleteAccount, getBodyStats, getGoals, getProfile, userKeys, type BodyStats, type Goals, type UserProfile } from '@/api/user';

import Profile from '../../../app/(tabs)/profile';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));
const mockAppearance = jest.fn(() => 'system');
jest.mock('@/lib/appearance', () => ({ ...jest.requireActual('@/lib/appearance'), getAppearance: () => mockAppearance() }));
const mockSignOut = jest.fn();
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ signOut: mockSignOut }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getGoals: jest.fn(), getProfile: jest.fn(), getBodyStats: jest.fn(), deleteAccount: jest.fn() }));
jest.mock('@/api/food', () => ({ ...jest.requireActual('@/api/food'), getCustomFoodPage: jest.fn() }));
jest.mock('@/auth/oauthProviders', () => ({ signInWithGoogle: jest.fn(), signInWithApple: jest.fn() }));

const mockGet = jest.mocked(getGoals);
const mockProfile = jest.mocked(getProfile);
const mockBody = jest.mocked(getBodyStats);
const mockFoods = jest.mocked(getCustomFoodPage);
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
  mockFoods.mockResolvedValue({ content: [], page: 0, size: 1, totalElements: 5, totalPages: 5 });
});

const OFFLINE = "You're offline. Check your connection and try again.";

describe('Profile body stats card', () => {
  it('shows a skeleton, then the saved stats, and opens the editor', async () => {
    let release: (v: Awaited<ReturnType<typeof getBodyStats>>) => void = () => undefined;
    mockBody.mockReturnValue(new Promise((r) => { release = r; }));
    await renderScreen();
    expect(screen.getAllByRole('progressbar', { name: 'Loading your profile' }).length).toBeGreaterThan(0);
    await act(async () => release(BODY));
    expect(await screen.findByText('180 cm')).toBeTruthy();
    expect(screen.getByText('80.5 kg')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Edit body stats$/ }));
    expect(mockPush).toHaveBeenCalledWith('/edit-body-stats');
  });

  it('offers Add body stats when none are saved', async () => {
    mockBody.mockResolvedValue(null);
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Add body stats' }));
    expect(mockPush).toHaveBeenCalledWith('/edit-body-stats');
  });

  it('shows an offline banner with Retry while the other cards stay', async () => {
    mockBody.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    expect(await screen.findByText(OFFLINE)).toBeTruthy();
    expect(screen.getByText('Daily goal')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Retry' })));
    expect(await screen.findByText('180 cm')).toBeTruthy();
  });
});

describe('Profile goals card', () => {
  it('shows a skeleton, then the goals with chip and shares', async () => {
    let release: (v: Awaited<ReturnType<typeof getGoals>>) => void = () => undefined;
    mockGet.mockReturnValue(new Promise((r) => { release = r; }));
    await renderScreen();
    expect(screen.getAllByRole('progressbar', { name: 'Loading your profile' }).length).toBeGreaterThan(0);
    await act(async () => release(GOALS));
    expect(await screen.findByText('Set by you')).toBeTruthy();
    expect(screen.getByText('150 g')).toBeTruthy();
    expect(screen.getByText('27% of kcal')).toBeTruthy();
  });

  it.each([
    [{ isAutoCalculated: true }, 'From body stats'],
    [{ updatedAt: null }, 'Default targets'],
  ])('shows the chip for %j', async (patch, label) => {
    mockGet.mockResolvedValue({ ...GOALS, ...patch });
    await renderScreen();
    expect(await screen.findByText(label)).toBeTruthy();
  });

  it('opens Edit goals from its button', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit goals' }));
    expect(mockPush).toHaveBeenCalledWith('/edit-goals');
  });

  it('shows an offline banner with Retry that refetches', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError());
    await renderScreen();
    expect(await screen.findByText(OFFLINE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit goals' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Set by you')).toBeTruthy();
  });

  it('shows a load error without the card while profile and body stats render', async () => {
    mockGet.mockRejectedValue(new Error('x'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your goals.")).toBeTruthy();
    expect(screen.getByText('sam k')).toBeTruthy();
    expect(screen.getByText('180 cm')).toBeTruthy();
  });
});

describe('Profile My Foods row', () => {
  it('shows the custom food count and opens My Foods', async () => {
    await renderScreen();
    expect(await screen.findByText('5')).toBeTruthy();
    expect(mockFoods).toHaveBeenCalledWith(0, 1);
    await fireEvent.press(screen.getByRole('button', { name: 'My Foods' }));
    expect(mockPush).toHaveBeenCalledWith('/my-foods');
  });

  it('shows 0 when there are none', async () => {
    mockFoods.mockResolvedValue({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 });
    await renderScreen();
    expect(await screen.findByText('0')).toBeTruthy();
  });

  it('shows no value while loading or on error', async () => {
    mockFoods.mockRejectedValue(new Error('x'));
    await renderScreen();
    await screen.findByText('sam k');
    expect(screen.queryByText('5')).toBeNull();
    expect(screen.getByRole('button', { name: 'My Foods' })).toBeTruthy();
  });
});

describe('Profile header', () => {
  it('shows a skeleton, then the name and email without the timezone', async () => {
    let release: (v: Awaited<ReturnType<typeof getProfile>>) => void = () => undefined;
    mockProfile.mockReturnValue(new Promise((r) => { release = r; }));
    await renderScreen();
    expect(screen.getAllByRole('progressbar', { name: 'Loading your profile' }).length).toBeGreaterThan(0);
    await act(async () => release(PROFILE));
    expect(await screen.findByText('sam k')).toBeTruthy();
    expect(screen.getByText('sam@example.com')).toBeTruthy();
    expect(screen.queryByText('Europe/London')).toBeNull();
    expect(screen.queryByText('Profile')).toBeNull();
  });

  it('shows the new name when the profile cache is updated after an edit', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <Profile />
      </QueryClientProvider>,
    );
    await screen.findByText('sam k');
    await act(async () => client.setQueryData(userKeys.profile, { ...PROFILE, name: 'Alex' }));
    expect(await screen.findByText('Alex')).toBeTruthy();
  });

  it('opens Edit profile', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit profile' }));
    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });

  it('shows an offline banner with Retry that refetches the profile', async () => {
    mockProfile.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(PROFILE);
    await renderScreen();
    expect(await screen.findByText(OFFLINE)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('sam k')).toBeTruthy();
  });

  it('shows a load error without an edit button or Delete account', async () => {
    mockProfile.mockRejectedValue(new Error('x'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your profile.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
  });
});

describe('Profile sign out and delete account', () => {
  it('signs out with one tap and no confirmation', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('hides Delete account until the profile has loaded', async () => {
    mockProfile.mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
  });

  it('opens the dialog, deletes with the password, then signs out once', async () => {
    jest.mocked(deleteAccount).mockResolvedValue(null);
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'pw-1');
    const buttons = screen.getAllByRole('button', { name: 'Delete account' });
    await fireEvent.press(buttons[buttons.length - 1]);
    expect(deleteAccount).toHaveBeenCalledWith({ password: 'pw-1' });
    await act(async () => undefined);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete your account?')).toBeNull();
  });

  it('does not sign out when the user cancels', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

describe('Profile appearance row', () => {
  it('shows System by default and opens the picker', async () => {
    mockAppearance.mockReturnValue('system');
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Appearance. System' }));
    expect(mockPush).toHaveBeenCalledWith('/appearance');
  });

  it('shows the stored choice', async () => {
    mockAppearance.mockReturnValue('dark');
    await renderScreen();
    expect(screen.getByRole('button', { name: 'Appearance. Dark' })).toBeTruthy();
  });
});
