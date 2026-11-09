import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getDashboard, type Dashboard } from '@/api/tracking';
import { addDays, isoDate } from '@/lib/dashboardView';

import Today from './index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), getDashboard: jest.fn() }));

const mockGet = jest.mocked(getDashboard);
const macro = (consumed: number, goal: number) => ({ consumed, goal, unit: 'g' as const });
const DAY: Dashboard = {
  date: '2026-11-09',
  calories: { consumed: 1450, goal: 2200, remaining: 750 },
  macros: { protein: macro(120, 165), carbs: macro(150, 250), fat: macro(40, 70) },
  entries: [
    { id: 'e1', foodName: 'Greek yogurt', source: 'USDA', mealLabel: 'breakfast', calories: 150, protein: 15, carbs: 8, fat: 4, loggedAt: '2026-11-09T08:00:00Z' },
  ],
  streak: { current: 5, longest: 9 },
};

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Today />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('Today screen', () => {
  it('shows the skeleton, then ring, pills, streak and meals', async () => {
    let resolve: (d: Dashboard) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    expect(screen.getByLabelText('Loading your day')).toBeTruthy();
    await act(async () => resolve(DAY));
    expect(await screen.findByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
    expect(screen.getByLabelText('Protein, 120 of 165 grams')).toBeTruthy();
    expect(screen.getByText('5 day streak')).toBeTruthy();
    expect(screen.getByText('Greek yogurt')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(undefined);
  });

  it('shows the empty state with a Log a meal action when nothing is logged', async () => {
    mockGet.mockResolvedValue({ ...DAY, entries: [], calories: { consumed: 0, goal: 2200, remaining: 2200 } });
    await renderScreen();
    expect(await screen.findByText('Nothing logged yet')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Log a meal' });
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith('/quick-log');
  });

  it('opens quick log from the FAB', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await screen.findByText('Greek yogurt');
    await fireEvent.press(screen.getByRole('button', { name: 'Log a meal' }));
    expect(mockPush).toHaveBeenCalledWith('/quick-log');
  });

  it('shows an offline error with Retry that refetches', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(DAY);
    await renderScreen();
    expect(await screen.findByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Greek yogurt')).toBeTruthy();
  });

  it('shows a generic error when the server fails', async () => {
    mockGet.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your day")).toBeTruthy();
  });

  it('refetches on pull to refresh', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await screen.findByText('Greek yogurt');
    await act(async () => {
      screen.getByTestId('today-scroll').props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('keeps stale data and shows a banner when a refetch fails', async () => {
    mockGet.mockResolvedValueOnce(DAY).mockRejectedValue(new NetworkError());
    await renderScreen();
    await screen.findByText('Greek yogurt');
    await act(async () => {
      screen.getByTestId('today-scroll').props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText("You're offline. Showing the last data we have.")).toBeTruthy();
    expect(screen.getByText('Greek yogurt')).toBeTruthy();
  });

  it('goes to the previous day with an explicit date and disables Next on today', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await screen.findByText('Greek yogurt');
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
    const yesterday = addDays(isoDate(new Date()), -1);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(yesterday));
    expect(await screen.findByText('Yesterday')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled();
  });
});
