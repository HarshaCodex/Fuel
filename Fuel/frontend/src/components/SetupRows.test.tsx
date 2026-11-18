import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { emptyBodyStatsForm } from '@/lib/bodyStatsForm';
import { hapticLight } from '@/lib/haptics';
import { setupRows } from '@/lib/setupView';
import { lightColors } from '@/theme';

import { SetupRows } from './SetupRows';

jest.mock('@/lib/haptics', () => ({ hapticLight: jest.fn() }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

const empty = setupRows(emptyBodyStatsForm('metric'));
const filled = setupRows({ ...emptyBodyStatsForm('metric'), age: '31', heightCm: '178', weight: '80', gender: 'MALE', activityLevel: 'MODERATE' });
afterEach(() => jest.clearAllMocks());

describe('SetupRows', () => {
  it('shows the five labels with Add when empty', async () => {
    await render(<SetupRows rows={empty} onPress={() => {}} />);
    for (const l of ['Age', 'Sex', 'Height', 'Weight', 'Activity']) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getAllByText('Add')).toHaveLength(5);
    expect(screen.getByLabelText('Age, not set')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByText('Add')[0].props.style).color).toBe(lightColors.accentText);
  });

  it('shows values when set', async () => {
    await render(<SetupRows rows={filled} onPress={() => {}} />);
    expect(screen.getByText('178 cm')).toBeTruthy();
    expect(screen.getByLabelText('Age, 31')).toBeTruthy();
    expect(screen.queryByText('Add')).toBeNull();
  });

  it('presses with the key and a haptic', async () => {
    const onPress = jest.fn();
    await render(<SetupRows rows={empty} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Height, not set'));
    expect(onPress).toHaveBeenCalledWith('height');
    expect(hapticLight).toHaveBeenCalledTimes(1);
  });

  it('turns the value red and appends the message on error', async () => {
    await render(<SetupRows rows={empty} onPress={() => {}} errors={{ age: 'Enter 13 to 120' }} />);
    expect(screen.getByLabelText('Age, not set. Enter 13 to 120')).toBeTruthy();
    expect(screen.getByText('Enter 13 to 120')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getAllByText('Add')[0].props.style).color).toBe(lightColors.danger);
  });
});
