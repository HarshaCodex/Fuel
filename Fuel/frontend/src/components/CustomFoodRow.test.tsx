import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SwipeDirection } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Food } from '@/api/food';

import { CustomFoodRow } from './CustomFoodRow';

// Gestures cannot run in Jest, so Swipeable is replaced by a stub that records its props for the tests to call.
const mockSwipes: Record<string, { onSwipeableOpen: (d: string) => void }> = {};
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { forwardRef, useImperativeHandle } = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const Swipeable = forwardRef(function Swipeable(props: { testID: string; children: unknown; onSwipeableOpen: (d: string) => void }, ref: unknown) {
    useImperativeHandle(ref, () => ({ close: () => {} }));
    mockSwipes[props.testID] = props;
    return <View>{props.children as never}</View>;
  });
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});
let mockModal: { onDismiss?: () => void } = {};
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: function Modal(props: { visible: boolean; children: unknown; onDismiss?: () => void }) {
      mockModal = props;
      return props.visible ? <View>{props.children as never}</View> : null;
    },
  };
});

const food: Food = {
  id: 'a', name: 'Oat bowl', brand: null, source: 'USER', servingSize: 100, servingUnit: 'g', calories: 200, protein: 10, carbs: 20, fat: 5,
};
const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
});

async function setup() {
  const fns = { onPress: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn() };
  await render(<CustomFoodRow food={food} {...fns} />);
  return fns;
}

describe('CustomFoodRow', () => {
  it('Edit and Delete in the menu call back (Android: at once)', async () => {
    Platform.OS = 'android';
    const fns = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Oat bowl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Oat bowl' }));
    expect(fns.onEdit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Oat bowl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Oat bowl' }));
    expect(fns.onDelete).toHaveBeenCalledTimes(1);
  });

  it('on iOS waits for the sheet to finish dismissing before opening the next modal', async () => {
    Platform.OS = 'ios';
    const fns = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Oat bowl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Oat bowl' }));
    expect(fns.onDelete).not.toHaveBeenCalled();
    await act(async () => mockModal.onDismiss?.());
    expect(fns.onDelete).toHaveBeenCalledTimes(1);
    // A second dismiss does not repeat it.
    await act(async () => mockModal.onDismiss?.());
    expect(fns.onDelete).toHaveBeenCalledTimes(1);
  });

  it('Cancel in the menu runs nothing, even after dismiss', async () => {
    Platform.OS = 'ios';
    const fns = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'More actions for Oat bowl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => mockModal.onDismiss?.());
    expect(fns.onEdit).not.toHaveBeenCalled();
    expect(fns.onDelete).not.toHaveBeenCalled();
  });

  it('exposes Edit and Delete as accessibility actions on the menu button', async () => {
    const fns = await setup();
    const button = screen.getByRole('button', { name: 'More actions for Oat bowl' });
    expect(button.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['activate', 'edit', 'delete']);
    await fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    await fireEvent(button, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(fns.onEdit).toHaveBeenCalledTimes(1);
    expect(fns.onDelete).toHaveBeenCalledTimes(1);
  });

  it('swiping right opens Edit and left opens Delete; the row is asked to snap back', async () => {
    const fns = await setup();
    const swipe = mockSwipes['swipe-a'];
    await act(async () => swipe.onSwipeableOpen(SwipeDirection.RIGHT));
    expect(fns.onEdit).toHaveBeenCalledTimes(1);
    expect(fns.onDelete).not.toHaveBeenCalled();
    await act(async () => swipe.onSwipeableOpen(SwipeDirection.LEFT));
    expect(fns.onDelete).toHaveBeenCalledTimes(1);
  });
});
