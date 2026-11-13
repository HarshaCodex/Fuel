import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import { shadow } from '@/theme';

import { LogFoodButton } from './LogFoodButton';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

beforeEach(() => {
  mockScheme.mockReturnValue('light');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

describe('LogFoodButton', () => {
  it('is a button labelled "Log food" that shows its text and calls onPress once per tap', async () => {
    const onPress = jest.fn();
    await render(<LogFoodButton onPress={onPress} />);
    await act(async () => {});
    expect(screen.getByText('Log food')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is at least 44pt tall', async () => {
    await render(<LogFoodButton onPress={jest.fn()} />);
    await act(async () => {});
    const style = StyleSheet.flatten(screen.getByRole('button', { name: 'Log food' }).props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('scales to 0.98 while pressed', async () => {
    const spring = jest.spyOn(Animated, 'spring');
    await render(<LogFoodButton onPress={jest.fn()} />);
    await act(async () => {});
    await fireEvent(screen.getByRole('button', { name: 'Log food' }), 'pressIn');
    expect(spring).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.98 }));
  });

  it('has a shadow in light mode and none in dark mode', async () => {
    const outer = () => StyleSheet.flatten(screen.getByRole('button', { name: 'Log food' }).parent?.props.style);
    const { unmount } = await render(<LogFoodButton onPress={jest.fn()} />);
    expect(outer().shadowOpacity).toBe(shadow.lg.shadowOpacity);
    await unmount();
    mockScheme.mockReturnValue('dark');
    await render(<LogFoodButton onPress={jest.fn()} />);
    expect(outer().shadowOpacity).toBeUndefined();
  });
});
