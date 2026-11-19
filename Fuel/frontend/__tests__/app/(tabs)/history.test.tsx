import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getDashboard, getHistory, type HistoryDay } from '@/api/tracking';
import { addDays, isoDate } from '@/lib/dashboardView';
import { hapticSelect } from '@/lib/haptics';
import { cellA11yLabel } from '@/lib/historyView';

import History from '../../../app/(tabs)/history';

jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn(), hapticLight: jest.fn() }));
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('@/api/tracking', () => ({
  ...jest.requireActual('@/api/tracking'),
  getHistory: jest.fn(),
  getDashboard: jest.fn(),
}));

let mockToday = '';
jest.mock('@/lib/useToday', () => ({ useToday: () => mockToday }));
const mockGet = jest.mocked(getHistory);
const mockDash = jest.mocked(getDashboard);
const TODAY = isoDate(new Date());
const YESTERDAY = addDays(TODAY, -1);
mockToday = TODAY;
const day = (date: string, calories: number): HistoryDay => ({
  date, calories, calorieGoal: 2200, protein: 120, carbs: 140, fat: 45, fiber: 20, entryCount: 4,
});
const DAYS = [day(TODAY, 1450), day(YESTERDAY, 2300)];
const dashboard = (longest: number) => ({ streak: { current: 3, longest } }) as Awaited<ReturnType<typeof getDashboard>>;

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <History />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockToday = TODAY;
  mockDash.mockResolvedValue(dashboard(5));
});

describe('History screen', () => {
  it('follows a month-end rollover from the profile-zone date', async () => {
    mockGet.mockResolvedValue([]);
    mockToday = '2026-10-31';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = () => (
      <QueryClientProvider client={client}>
        <History />
      </QueryClientProvider>
    );
    const view = await render(ui());
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31'));
    mockToday = '2026-11-01';
    await view.rerender(ui());
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('2026-11-01', '2026-11-01'));
  });

  it('shows skeleton rings with usable arrows while loading, then the card and summary', async () => {
    let resolve: (d: HistoryDay[]) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous month' }).props.accessibilityState.disabled).toBe(false);
    await act(async () => resolve(DAYS));
    expect(await screen.findByText('Today')).toBeTruthy();
    expect(screen.getByLabelText(/^Average /)).toBeTruthy();
    expect(screen.getByLabelText('Streak, 3 days')).toBeTruthy();
  });

  it('requests the current month up to today and disables Next', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByText('Today');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`${TODAY.slice(0, 8)}01`, TODAY);
    expect(screen.getByRole('button', { name: 'Next month' }).props.accessibilityState.disabled).toBe(true);
  });

  it('fetches an earlier month once and does not refetch it when revisited', async () => {
    mockGet.mockResolvedValue([]);
    await renderScreen();
    await screen.findByText('Today');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await screen.findByText('No entries');
    expect(mockGet).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await screen.findByText('Today');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await screen.findByText('No entries');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('opens the selected logged day from the card', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: /^Today, 1,450 kcal/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day', params: { date: TODAY } });
  });

  it('shows No entries for an empty day and does not navigate', async () => {
    mockGet.mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('No entries')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Open day/ })).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the empty state only for a new user with no logs ever', async () => {
    mockGet.mockResolvedValue([]);
    mockDash.mockResolvedValue(dashboard(0));
    await renderScreen();
    await fireEvent.press(await screen.findByText('Go to Today'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows an offline error with Retry when nothing is cached', async () => {
    mockGet.mockRejectedValue(new NetworkError());
    await renderScreen();
    expect(await screen.findByText("You're offline")).toBeTruthy();
    mockGet.mockResolvedValue(DAYS);
    await fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Today')).toBeTruthy();
  });

  it('shows a generic error when the server fails', async () => {
    mockGet.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your history")).toBeTruthy();
  });

  it('keeps the data and shows a banner when a refresh fails', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByText('Today');
    mockGet.mockRejectedValue(new NetworkError());
    await act(async () => {
      await screen.getByTestId('history-scroll').props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText(/You're offline. Showing the last data/)).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('refetches only the shown month on pull to refresh', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByText('Today');
    await act(async () => {
      await screen.getByTestId('history-scroll').props.refreshControl.props.onRefresh();
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('selects a pressed calendar day, updates the card and fires a haptic', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByText('Today');
    await fireEvent.press(screen.getByLabelText(cellA11yLabel(YESTERDAY, DAYS[1], TODAY)));
    expect(await screen.findByRole('button', { name: /2,300 kcal.*Open day/ })).toBeTruthy();
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it('selects the last logged day of an earlier month and opens it', async () => {
    const [y, m] = TODAY.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const older = isoDate(new Date(prev.getFullYear(), prev.getMonth(), 10));
    const last = isoDate(new Date(prev.getFullYear(), prev.getMonth(), 20));
    mockGet.mockImplementation(async (from: string) =>
      from === `${TODAY.slice(0, 8)}01` ? DAYS : [day(older, 1000), day(last, 1800)],
    );
    await renderScreen();
    await screen.findByText('Today');
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(await screen.findByRole('button', { name: /1,800 kcal.*Open day/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day', params: { date: last } });
  });

  it('still renders the calendar and card when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    mockGet.mockResolvedValueOnce(DAYS).mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('Today')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('No entries')).toBeTruthy();
  });
});
