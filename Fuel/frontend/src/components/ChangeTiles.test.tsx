import { fireEvent, render, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { hapticSelect } from '@/lib/haptics';

import { ChangeTiles } from './ChangeTiles';

jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('ChangeTiles', () => {
  it('renders the presets and Custom in a Daily change group', async () => {
    await render(<ChangeTiles value={500} onSelect={() => {}} onCustom={() => {}} />);
    expect(screen.getByLabelText('Daily change').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByLabelText('250, gentle')).toBeTruthy();
    expect(screen.getByLabelText('500, steady')).toBeSelected();
    expect(screen.getByLabelText('750, faster')).toBeTruthy();
    expect(screen.getByLabelText('Custom, kcal')).not.toBeSelected();
  });

  it('selects Custom and shows the amount for a non-preset value', async () => {
    await render(<ChangeTiles value={350} onSelect={() => {}} onCustom={() => {}} />);
    expect(screen.getByLabelText('350, kcal')).toBeSelected();
    expect(screen.getByLabelText('500, steady')).not.toBeSelected();
  });

  it('selects a preset once with a haptic, not when already selected', async () => {
    const onSelect = jest.fn();
    await render(<ChangeTiles value={500} onSelect={onSelect} onCustom={() => {}} />);
    await fireEvent.press(screen.getByLabelText('500, steady'));
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('750, faster'));
    expect(onSelect).toHaveBeenCalledWith(750);
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it('always calls onCustom, even when Custom is selected', async () => {
    const onCustom = jest.fn();
    await render(<ChangeTiles value={350} onSelect={() => {}} onCustom={onCustom} />);
    await fireEvent.press(screen.getByLabelText('350, kcal'));
    expect(onCustom).toHaveBeenCalledTimes(1);
  });

  it('wraps into a grid at large text sizes', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    await render(<ChangeTiles value={500} onSelect={() => {}} onCustom={() => {}} />);
    expect(StyleSheet.flatten(screen.getByLabelText('Daily change').props.style).flexWrap).toBe('wrap');
  });
});
