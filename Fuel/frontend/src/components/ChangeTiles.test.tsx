import { fireEvent, render, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { darkColors } from '@/theme';

import { hapticSelect } from '@/lib/haptics';

import { ChangeTiles } from './ChangeTiles';

jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
beforeEach(() => mockScheme.mockReturnValue('light'));
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('ChangeTiles', () => {
  it('renders the presets and Custom in a Daily change group', async () => {
    await render(<ChangeTiles value={500} onSelect={() => {}} onCustom={() => {}} />);
    expect(screen.getByLabelText('Daily calorie change').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByLabelText('250 calories a day, gentle')).toBeTruthy();
    expect(screen.getByLabelText('500 calories a day, steady')).toBeSelected();
    expect(screen.getByLabelText('750 calories a day, faster')).toBeTruthy();
    expect(screen.getByLabelText('Custom, enter an amount')).not.toBeSelected();
  });

  it('selects Custom and shows the amount for a non-preset value', async () => {
    await render(<ChangeTiles value={350} onSelect={() => {}} onCustom={() => {}} />);
    expect(screen.getByLabelText('Custom amount, 350 calories a day')).toBeSelected();
    expect(screen.getByLabelText('500 calories a day, steady')).not.toBeSelected();
  });

  it('selects a preset once with a haptic, not when already selected', async () => {
    const onSelect = jest.fn();
    await render(<ChangeTiles value={500} onSelect={onSelect} onCustom={() => {}} />);
    await fireEvent.press(screen.getByLabelText('500 calories a day, steady'));
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('750 calories a day, faster'));
    expect(onSelect).toHaveBeenCalledWith(750);
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it('always calls onCustom, even when Custom is selected', async () => {
    const onCustom = jest.fn();
    await render(<ChangeTiles value={350} onSelect={() => {}} onCustom={onCustom} />);
    await fireEvent.press(screen.getByLabelText('Custom amount, 350 calories a day'));
    expect(onCustom).toHaveBeenCalledTimes(1);
  });

  it('wraps into a grid at large text sizes', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    await render(<ChangeTiles value={500} onSelect={() => {}} onCustom={() => {}} />);
    expect(StyleSheet.flatten(screen.getByLabelText('Daily calorie change').props.style).flexWrap).toBe('wrap');
  });

  it('blocks presses and marks tiles disabled when disabled', async () => {
    const onSelect = jest.fn();
    const onCustom = jest.fn();
    await render(<ChangeTiles value={500} onSelect={onSelect} onCustom={onCustom} disabled />);
    await fireEvent.press(screen.getByLabelText('750 calories a day, faster'));
    await fireEvent.press(screen.getByLabelText('Custom, enter an amount'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCustom).not.toHaveBeenCalled();
    expect(screen.getByLabelText('750 calories a day, faster')).toBeDisabled();
  });

  it('uses a hairline and no shadow in dark', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<ChangeTiles value={500} onSelect={() => {}} onCustom={() => {}} />);
    const style = StyleSheet.flatten(screen.getByLabelText('750 calories a day, faster').props.style);
    expect(style.borderColor).toBe(darkColors.border);
    expect(style.shadowOpacity).toBeUndefined();
  });
});
