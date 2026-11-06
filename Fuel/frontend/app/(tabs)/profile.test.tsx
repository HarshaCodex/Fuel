import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NetworkError } from '@/api/errors';
import { getGoals, type Goals } from '@/api/user';

import Profile from './profile';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getGoals: jest.fn() }));

const mockGet = jest.mocked(getGoals);
const GOALS: Goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70.5, isAutoCalculated: false, updatedAt: '2026-11-01T00:00:00Z' };

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Profile />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

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
});
