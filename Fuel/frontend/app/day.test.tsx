import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { getDashboard, type Dashboard } from '@/api/tracking';

import Day from './day';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { children: unknown }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: jest.fn() }));
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});
const mockBack = jest.fn();
let mockParams: { date?: string | string[] } = { date: '2026-11-03' };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), getDashboard: jest.fn() }));

const mockGet = jest.mocked(getDashboard);
const macro = (consumed: number, goal: number) => ({ consumed, goal, unit: 'g' as const });
const DAY: Dashboard = {
  date: '2026-11-03',
  calories: { consumed: 1450, goal: 2200, remaining: 750 },
  macros: { protein: macro(120, 165), carbs: macro(150, 250), fat: macro(40, 70) },
  entries: [
    { id: 'e1', foodName: 'Greek yogurt', source: 'USDA', mealLabel: 'breakfast', calories: 150, protein: 15, carbs: 8, fat: 4, loggedAt: '2026-11-03T08:00:00Z' },
  ],
  streak: { current: 5, longest: 9 },
};

async function renderScreen() {
  await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Day />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { date: '2026-11-03' };
});

describe('Day screen', () => {
  it('shows the requested day read-only: ring, pills and meals, no streak or actions', async () => {
    let resolve: (d: Dashboard) => void = () => {};
    mockGet.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen();
    expect(screen.getByLabelText('Loading your day')).toBeTruthy();
    await act(async () => resolve(DAY));
    expect(await screen.findByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
    expect(screen.getByLabelText('Protein, 120 of 165 grams')).toBeTruthy();
    expect(screen.getByText('Greek yogurt')).toBeTruthy();
    expect(screen.getByText('Tue, Nov 3')).toBeTruthy();
    expect(screen.queryByText('5 day streak')).toBeNull();
    expect(screen.queryByRole('button', { name: /More actions|Delete|Edit/ })).toBeNull();
    expect(mockGet).toHaveBeenCalledWith('2026-11-03');
  });

  it('says No entries for a past day with nothing logged', async () => {
    mockGet.mockResolvedValue({ ...DAY, entries: [], calories: { consumed: 0, goal: 2200, remaining: 2200 } });
    await renderScreen();
    expect(await screen.findByText('No entries')).toBeTruthy();
  });

  it('goes back from the header', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it.each([[undefined], ['nope'], ['2026-13-40'], ['2026-02-30'], ['2026-11-03/../x'], [['2026-11-03', '2026-11-04']]])(
    'shows an error and sends no request for the date %p',
    async (date) => {
      mockParams = { date };
      await renderScreen();
      expect(await screen.findByText("We can't open that day")).toBeTruthy();
      expect(mockGet).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Back to History' }));
      expect(mockBack).toHaveBeenCalled();
    },
  );

  it('shows an offline error with Retry', async () => {
    mockGet.mockRejectedValueOnce(new NetworkError()).mockResolvedValue(DAY);
    await renderScreen();
    expect(await screen.findByText("You're offline")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Greek yogurt')).toBeTruthy();
  });

  it('shows a generic error for a server failure', async () => {
    mockGet.mockRejectedValue(new ApiError(404, 'missing'));
    await renderScreen();
    expect(await screen.findByText("Couldn't load this day")).toBeTruthy();
  });

  it('refetches on pull to refresh', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await screen.findByText('Greek yogurt');
    await act(async () => {
      await screen.getByTestId('day-scroll').props.refreshControl.props.onRefresh();
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
