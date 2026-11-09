import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import type { DashboardEntry } from '@/api/tracking';

import { MealEntryRow } from './MealEntryRow';

// Gestures cannot run in Jest, so Swipeable is replaced by a stub that records its props for the tests to call.
const mockClose = jest.fn();
const mockSwipes: Record<string, { onSwipeableOpen: (d: string) => void }> = {};
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { testID: string; children: unknown; onSwipeableOpen: (d: string) => void }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: mockClose }));
    mockSwipes[props.testID] = props;
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function Modal(props: { visible: boolean; children: unknown }) {
      return props.visible ? <View>{props.children as never}</View> : null;
    },
  };
});

const entry: DashboardEntry = {
  id: 'e1', foodName: 'Oat bowl', source: 'USDA', mealLabel: 'breakfast', calories: 200, protein: 10, carbs: 20, fat: 5, loggedAt: '2026-11-09T08:00:00Z',
};
const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
  jest.clearAllMocks();
});

describe('MealEntryRow', () => {
  it('swiping open closes the row and deletes the entry', async () => {
    const onDelete = jest.fn();
    await render(<MealEntryRow entry={entry} onDelete={onDelete} />);
    mockSwipes['swipe-e1'].onSwipeableOpen('left');
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('the More actions button opens a menu with Delete, which deletes', async () => {
    Platform.OS = 'android';
    const onDelete = jest.fn();
    await render(<MealEntryRow entry={entry} onDelete={onDelete} />);
    expect(screen.queryByLabelText('Cancel')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Oat bowl' }));
    expect(screen.queryByLabelText('Edit Oat bowl')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Oat bowl' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('exposes delete as an accessibility action and offers edit only when handled', async () => {
    const onDelete = jest.fn();
    await render(<MealEntryRow entry={entry} onDelete={onDelete} />);
    const more = screen.getByRole('button', { name: 'More actions for Oat bowl' });
    expect(more.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['activate', 'delete']);
    await fireEvent(more, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('runs edit from the accessibility action when given', async () => {
    const onEdit = jest.fn();
    await render(<MealEntryRow entry={entry} onDelete={jest.fn()} onEdit={onEdit} />);
    const more = screen.getByRole('button', { name: 'More actions for Oat bowl' });
    await fireEvent(more, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
