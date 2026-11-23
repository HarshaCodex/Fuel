import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Platform } from 'react-native';

import type { DashboardEntry } from '@/api/tracking';

import { MealCard } from './MealCard';

// Gestures cannot run in Jest, so Swipeable is replaced by a stub that records its props for the tests to call.
const mockSwipes: Record<string, { onSwipeableOpen: (d: string) => void }> = {};
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { testID: string; children: unknown; onSwipeableOpen: (d: string) => void }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: jest.fn() }));
    mockSwipes[props.testID] = props;
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (p: { visible: boolean; children: unknown }) => (p.visible ? <View>{p.children as never}</View> : null) };
});

const entry = (id: string, foodName: string, calories = 150): DashboardEntry => ({
  id, foodName, source: 'USDA', mealLabel: 'breakfast', calories, protein: 10, carbs: 10, fat: 5, loggedAt: '2026-11-09T08:00:00Z',
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

const mount = async (entries: DashboardEntry[], onDeleteEntry = jest.fn(), onEditEntry = jest.fn()) => {
  await render(<MealCard title="Breakfast" entries={entries} onDeleteEntry={onDeleteEntry} onEditEntry={onEditEntry} />);
  await act(async () => {});
  return { onDeleteEntry, onEditEntry };
};

describe('MealCard', () => {
  it('shows the title as a header and every row', async () => {
    await mount([entry('a', 'Greek yogurt'), entry('b', 'Toast', 100)]);
    expect(screen.getByRole('header', { name: 'Breakfast' })).toBeOnTheScreen();
    expect(screen.getByText('Greek yogurt')).toBeOnTheScreen();
    expect(screen.getByText('Toast')).toBeOnTheScreen();
  });

  it('puts a divider between rows only: none for one row, n-1 for n rows', async () => {
    const { unmount } = await render(<MealCard title="Lunch" entries={[entry('a', 'Rice')]} onDeleteEntry={jest.fn()} onEditEntry={jest.fn()} />);
    expect(screen.queryAllByTestId('meal-divider')).toHaveLength(0);
    await unmount();
    await mount([entry('a', 'Rice'), entry('b', 'Egg'), entry('c', 'Apple')]);
    expect(screen.getAllByTestId('meal-divider')).toHaveLength(2);
  });

  it('deletes and edits the right entry from the row menu', async () => {
    const a = entry('a', 'Greek yogurt');
    const b = entry('b', 'Toast');
    const { onDeleteEntry, onEditEntry } = await mount([a, b]);
    Platform.OS = 'android';
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Toast' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Toast' }));
    expect(onEditEntry).toHaveBeenCalledWith(b);
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Greek yogurt' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Greek yogurt' }));
    expect(onDeleteEntry).toHaveBeenCalledWith(a);
    expect(onDeleteEntry).toHaveBeenCalledTimes(1);
  });

  it('deletes the swiped entry', async () => {
    const a = entry('a', 'Greek yogurt');
    const { onDeleteEntry } = await mount([a]);
    await act(async () => mockSwipes['swipe-a'].onSwipeableOpen('right'));
    expect(onDeleteEntry).toHaveBeenCalledWith(a);
  });

  it('opens the editor on long press', async () => {
    const a = entry('a', 'Greek yogurt');
    const { onEditEntry } = await mount([a]);
    await fireEvent(screen.getByText('Greek yogurt'), 'longPress');
    expect(onEditEntry).toHaveBeenCalledWith(a);
  });

  it('springs the pressed row to 0.98', async () => {
    const spring = jest.spyOn(Animated, 'spring');
    await mount([entry('a', 'Greek yogurt')]);
    await fireEvent(screen.getByText('Greek yogurt'), 'pressIn');
    expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.98 }));
  });

  it('renders nothing but the title for no entries, without crashing', async () => {
    await mount([]);
    expect(screen.getByText('Breakfast')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('meal-divider')).toHaveLength(0);
  });
});

