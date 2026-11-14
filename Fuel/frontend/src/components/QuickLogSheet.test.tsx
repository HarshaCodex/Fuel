import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, Text } from 'react-native';

import { DISMISS_DISTANCE, DISMISS_VELOCITY, QuickLogSheet } from './QuickLogSheet';

type PanConfig = { onDeactivate: (e: { translationY: number; velocityY: number }) => void };
let mockPan: PanConfig;
let mockReduce = false;
let mockFocused = true;

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: <T,>(v: T) => {
      const box = { value: v, get: () => box.value, set: (n: T) => { box.value = n; } };
      return box;
    },
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (v: number, _o: unknown, cb?: (f: boolean) => void) => {
      cb?.(true);
      return v;
    },
    withSpring: (v: number) => v,
  };
});
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: unknown }) => children,
  usePanGesture: (cfg: PanConfig) => {
    mockPan = cfg;
    return cfg;
  },
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) =>
    jest.requireActual('react').useEffect(() => (mockFocused ? cb() : undefined), [cb]),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...a: unknown[]) => fn(...a) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

const onClose = jest.fn();
const renderSheet = () =>
  render(
    <QuickLogSheet onClose={onClose}>
      {(close) => <Text onPress={close}>content</Text>}
    </QuickLogSheet>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockReduce = false;
  mockFocused = true;
});

describe('QuickLogSheet', () => {
  it('renders its content', async () => {
    await renderSheet();
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('closes once when the scrim is tapped, even twice', async () => {
    await renderSheet();
    const scrim = screen.getByRole('button', { name: 'Close Quick Log' });
    await fireEvent.press(scrim);
    await fireEvent.press(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through the close callback given to children', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByText('content'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Android back and consumes the event', async () => {
    let handler: (() => boolean | null | undefined) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handler = () => h(undefined as never);
      return { remove: jest.fn() };
    });
    await renderSheet();
    let result = false;
    await act(async () => {
      result = handler?.() === true;
    });
    expect(result).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen for Android back while another screen is on top', async () => {
    mockFocused = false;
    const add = jest.spyOn(BackHandler, 'addEventListener');
    await renderSheet();
    expect(add).not.toHaveBeenCalled();
  });

  it('closes on a long drag', async () => {
    await renderSheet();
    await act(async () => mockPan.onDeactivate({ translationY: DISMISS_DISTANCE + 1, velocityY: 0 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a fast fling', async () => {
    await renderSheet();
    await act(async () => mockPan.onDeactivate({ translationY: 10, velocityY: DISMISS_VELOCITY + 1 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on a short slow drag', async () => {
    await renderSheet();
    await act(async () => mockPan.onDeactivate({ translationY: 40, velocityY: 100 }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes with Reduce Motion on', async () => {
    mockReduce = true;
    await renderSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Close Quick Log' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
