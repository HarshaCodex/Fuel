import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getHistory, type HistoryDay } from '@/api/tracking';
import { addDays, isoDate } from '@/lib/dashboardView';
import { dayLabel } from '@/lib/historyView';

import History from './history';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: mockNavigate }) }));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), getHistory: jest.fn() }));

const mockGet = jest.mocked(getHistory);
const TODAY = isoDate(new Date());
const YESTERDAY = addDays(TODAY, -1);
const day = (date: string, calories: number): HistoryDay => ({
  date, calories, calorieGoal: 2200, protein: 120, carbs: 140, fat: 45, fiber: 20, entryCount: 4,
});
const DAYS = [day(TODAY, 1450), day(YESTERDAY, 2300)];

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <History />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe('History screen', () => {
  it('shows a skeleton, then summary, chart and rows newest first', async () => {
    let resolve: (d: HistoryDay[]) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    expect(screen.getByLabelText('Loading your history')).toBeTruthy();
    await act(async () => resolve(DAYS));
    expect(await screen.findByTestId('history-chart')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /^Open / });
    expect(rows).toHaveLength(2);
    expect(rows[0].props.accessibilityLabel).toBe(`Open ${dayLabel(TODAY)}`);
    expect(rows[1].props.accessibilityLabel).toBe(`Open ${dayLabel(YESTERDAY)}`);
  });

  it('requests exactly 7 days by default', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByTestId('history-chart');
    expect(mockGet).toHaveBeenCalledWith(addDays(TODAY, -6), TODAY);
  });

  it('refetches with a span of exactly 30 then 90 days when the range changes', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByTestId('history-chart');
    await fireEvent.press(screen.getByRole('radio', { name: '30 days' }));
    await screen.findByTestId('history-chart');
    expect(mockGet).toHaveBeenLastCalledWith(addDays(TODAY, -29), TODAY);
    await fireEvent.press(screen.getByRole('radio', { name: '90 days' }));
    await screen.findByTestId('history-chart');
    expect(mockGet).toHaveBeenLastCalledWith(addDays(TODAY, -89), TODAY);
  });

  it('keeps the old rows visible while a new range loads', async () => {
    mockGet.mockResolvedValueOnce(DAYS).mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await screen.findByTestId('history-chart');
    await fireEvent.press(screen.getByRole('radio', { name: '30 days' }));
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(2);
    expect(screen.queryByLabelText('Loading your history')).toBeNull();
  });

  it('opens a day when its row is tapped', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: `Open ${dayLabel(YESTERDAY)}` }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/day', params: { date: YESTERDAY } });
  });

  it('shows the empty state with a way back to Today', async () => {
    mockGet.mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('Your history starts with your first log')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Today' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows an offline error with Retry when nothing is cached', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(DAYS);
    await renderScreen();
    expect(await screen.findByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('history-chart')).toBeTruthy();
  });

  it('shows a generic error when the server fails', async () => {
    mockGet.mockRejectedValue(new ApiError(500, 'boom'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load your history")).toBeTruthy();
  });

  it('keeps the data and shows an offline banner when a refresh fails', async () => {
    mockGet.mockResolvedValueOnce(DAYS).mockRejectedValue(new NetworkError());
    await renderScreen();
    await screen.findByTestId('history-chart');
    await act(async () => {
      await screen.getByTestId('history-scroll').props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText("You're offline. Showing the last data we have.")).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(2);
  });

  it('refetches on pull to refresh', async () => {
    mockGet.mockResolvedValue(DAYS);
    await renderScreen();
    await screen.findByTestId('history-chart');
    await act(async () => {
      await screen.getByTestId('history-scroll').props.refreshControl.props.onRefresh();
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does not divide by zero when the goal is 0', async () => {
    mockGet.mockResolvedValue([{ ...day(TODAY, 500), calorieGoal: 0 }]);
    await renderScreen();
    expect(await screen.findByTestId('history-chart')).toBeTruthy();
  });
});
