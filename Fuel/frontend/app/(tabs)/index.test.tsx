import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteEntry, getDashboard, getEntries, updateEntry, type CreatedEntry, type Dashboard } from '@/api/tracking';
import { UNDO_MS } from '@/lib/usePendingDeletes';
import { addDays, isoDate } from '@/lib/dashboardView';

import Today from './index';

// Gestures cannot run in Jest, so Swipeable is replaced by a pass-through.
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

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/api/tracking', () => ({ ...jest.requireActual('@/api/tracking'), getDashboard: jest.fn(), deleteEntry: jest.fn(), getEntries: jest.fn(), updateEntry: jest.fn() }));
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (p: { visible: boolean; children: unknown }) => (p.visible ? <View>{p.children as never}</View> : null) };
});

const mockGet = jest.mocked(getDashboard);
const mockDelete = jest.mocked(deleteEntry);
const mockEntries = jest.mocked(getEntries);
const mockUpdate = jest.mocked(updateEntry);
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
    expect(screen.getByText('Meals')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(undefined);
  });

  it('shows the empty state with a Log your first food action when nothing is logged', async () => {
    mockGet.mockResolvedValue({ ...DAY, entries: [], calories: { consumed: 0, goal: 2200, remaining: 2200 } });
    await renderScreen();
    expect(await screen.findByText('Nothing logged yet')).toBeTruthy();
    expect(screen.getByText('Meals')).toBeTruthy();
    const buttons = [screen.getByRole('button', { name: 'Log your first food' }), screen.getByRole('button', { name: 'Log food' })];
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith('/quick-log');
  });

  it('opens quick log from the FAB', async () => {
    mockGet.mockResolvedValue(DAY);
    await renderScreen();
    await screen.findByText('Greek yogurt');
    await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
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

  describe('deleting an entry', () => {
    const TWO: Dashboard = {
      ...DAY,
      entries: [
        ...DAY.entries,
        { id: 'e2', foodName: 'Toast', source: 'USDA', mealLabel: 'breakfast', calories: 100, protein: 3, carbs: 18, fat: 1, loggedAt: '2026-11-09T09:00:00Z' },
      ],
    };
    const del = (name: string) =>
      fireEvent(screen.getByRole('button', { name: `More actions for ${name}` }), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      mockDelete.mockResolvedValue(null);
    });
    afterEach(() => jest.useRealTimers());

    it('hides the row at once, updates the totals and offers Undo', async () => {
      mockGet.mockResolvedValue(TWO);
      await renderScreen();
      await screen.findByText('Toast');
      expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
      await del('Toast');
      expect(screen.queryByText('Toast')).toBeNull();
      expect(screen.getByText('Toast deleted')).toBeTruthy();
      expect(screen.getByLabelText('850 calories remaining. 1,350 of 2,200 eaten.')).toBeTruthy();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('Undo restores the row and totals and never calls the server', async () => {
      mockGet.mockResolvedValue(TWO);
      await renderScreen();
      await screen.findByText('Toast');
      await del('Toast');
      await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByText('Toast')).toBeTruthy();
      expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
      await act(async () => void jest.advanceTimersByTime(UNDO_MS * 2));
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('deletes on the server after the undo window and refreshes', async () => {
      mockGet.mockResolvedValueOnce(TWO).mockResolvedValue({ ...DAY });
      await renderScreen();
      await screen.findByText('Toast');
      await del('Toast');
      await act(async () => void jest.advanceTimersByTime(UNDO_MS));
      expect(mockDelete).toHaveBeenCalledWith('e2');
      await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
      expect(screen.queryByText('Toast')).toBeNull();
      expect(screen.queryByText('Toast deleted')).toBeNull();
    });

    it('a refetch during the undo window does not bring the row back', async () => {
      mockGet.mockResolvedValue(TWO);
      await renderScreen();
      await screen.findByText('Toast');
      await del('Toast');
      await act(async () => {
        screen.getByTestId('today-scroll').props.refreshControl.props.onRefresh();
      });
      await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
      expect(screen.queryByText('Toast')).toBeNull();
    });

    it('shows the empty state and the lower totals when the last entry goes', async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await del('Greek yogurt');
      expect(screen.getByText('Nothing logged yet')).toBeTruthy();
      expect(screen.getByLabelText('900 calories remaining. 1,300 of 2,200 eaten.')).toBeTruthy();
    });

    it.each([
      [new ApiError(500, 'boom'), "Couldn't delete Toast. Try again."],
      [new NetworkError(), "You're offline. Toast wasn't deleted."],
      [new ApiError(404, 'gone'), 'Toast was already removed.'],
    ])('puts the row back and explains when the server fails (%#)', async (error, message) => {
      mockGet.mockResolvedValue(TWO);
      mockDelete.mockRejectedValue(error);
      await renderScreen();
      await screen.findByText('Toast');
      await del('Toast');
      await act(async () => void jest.advanceTimersByTime(UNDO_MS));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByText('Toast')).toBeTruthy();
      expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
    });
  });

  describe('editing an entry', () => {
    const FULL: CreatedEntry = { ...DAY.entries[0], foodId: 'f1', servingSize: 100, servingUnit: 'g', quantity: 1 };
    const edit = (name: string) =>
      fireEvent(screen.getByRole('button', { name: `More actions for ${name}` }), 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    const doubleIt = async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      await screen.findByText('Edit Greek yogurt');
      await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
    };
    beforeEach(() => {
      mockEntries.mockResolvedValue([FULL]);
      mockUpdate.mockResolvedValue({ ...FULL, quantity: 2, calories: 300 });
    });

    it('opens the sheet from the row action, saves, and updates the row and totals at once', async () => {
      await doubleIt();
      // The refresh after saving is held back so the optimistic estimate stays visible.
      mockGet.mockReturnValue(new Promise(() => {}));
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(mockUpdate).toHaveBeenCalledWith('e1', { quantity: 2 });
      expect(screen.queryByText('Edit Greek yogurt')).toBeNull();
      expect(await screen.findByLabelText('600 calories remaining. 1,600 of 2,200 eaten.')).toBeTruthy();
    });

    it('refreshes from the server after saving', async () => {
      await doubleIt();
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    });

    it.each([
      [new ApiError(500, 'boom'), "Couldn't save Greek yogurt. Try again."],
      [new NetworkError(), "You're offline. Greek yogurt wasn't changed."],
      [new ApiError(404, 'gone'), 'That entry no longer exists'],
      [new ApiError(400, 'Quantity is too large'), 'Quantity is too large'],
    ])('rolls the row and totals back and explains when saving fails (%#)', async (error, message) => {
      await doubleIt();
      mockUpdate.mockRejectedValue(error);
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
    });

    it('closes the sheet and says so when the entry is gone from the list', async () => {
      mockEntries.mockResolvedValue([]);
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      expect(await screen.findByText('That entry no longer exists')).toBeTruthy();
      expect(screen.queryByText('Edit Greek yogurt')).toBeNull();
    });

    it('a meal-only edit moves the row to the new group and leaves the totals alone', async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      await screen.findByText('Edit Greek yogurt');
      await fireEvent.press(screen.getByText('Dinner'));
      mockGet.mockReturnValue(new Promise(() => {}));
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(mockUpdate).toHaveBeenCalledWith('e1', { mealLabel: 'dinner' });
      expect(await screen.findByText('Dinner')).toBeTruthy();
      expect(screen.queryByText('Breakfast')).toBeNull();
      expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeTruthy();
    });

    it('rolls a failed meal move back to the original group', async () => {
      mockGet.mockResolvedValue(DAY);
      mockUpdate.mockRejectedValue(new NetworkError());
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      await screen.findByText('Edit Greek yogurt');
      await fireEvent.press(screen.getByText('Dinner'));
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText("You're offline. Greek yogurt wasn't changed.")).toBeTruthy();
      expect(screen.getByText('Breakfast')).toBeTruthy();
    });

    it('sends nothing when no value changed, because Save stays disabled', async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      await screen.findByText('Edit Greek yogurt');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('edits optimistically on a past day and refreshes that day', async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
      const yesterday = addDays(isoDate(new Date()), -1);
      await screen.findByText('Yesterday');
      await screen.findByRole('button', { name: 'More actions for Greek yogurt' });
      await edit('Greek yogurt');
      await screen.findByText('Edit Greek yogurt');
      await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Increase Quantity' }));
      mockGet.mockReturnValue(new Promise(() => {}));
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByLabelText('600 calories remaining. 1,600 of 2,200 eaten.')).toBeTruthy();
      expect(mockGet).toHaveBeenLastCalledWith(yesterday);
    });

    it('does not call the server when the entry is missing from the list', async () => {
      mockEntries.mockResolvedValue([]);
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await edit('Greek yogurt');
      await screen.findByText('That entry no longer exists');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('fetches the entry list for the shown date', async () => {
      mockGet.mockResolvedValue(DAY);
      await renderScreen();
      await screen.findByText('Greek yogurt');
      await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
      const yesterday = addDays(isoDate(new Date()), -1);
      await screen.findByText('Yesterday');
      await screen.findByRole('button', { name: 'More actions for Greek yogurt' });
      await edit('Greek yogurt');
      await waitFor(() => expect(mockEntries).toHaveBeenCalledWith(yesterday));
    });
  });
});
