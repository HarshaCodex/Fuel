import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { emptyBodyStatsForm, type BodyStatsForm } from '@/lib/bodyStatsForm';
import { hapticSelect } from '@/lib/haptics';
import { darkColors, lightColors } from '@/theme';

import { ChoiceSheet, CustomChangeSheet, StatSheet } from './SetupSheets';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));
jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn(), hapticLight: jest.fn() }));
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { __esModule: true, default: (p: { visible: boolean; children: unknown }) => (p.visible ? <View>{p.children as never}</View> : null) };
});

const form = (patch: Partial<BodyStatsForm> = {}): BodyStatsForm => ({ ...emptyBodyStatsForm('metric'), ...patch });
const noop = () => {};

beforeEach(() => mockScheme.mockReturnValue('light'));
afterEach(() => jest.clearAllMocks());

describe('StatSheet', () => {
  it('renders nothing when kind is null', async () => {
    await render(<StatSheet kind={null} form={form()} onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('disables Done and shows no error while the field is empty', async () => {
    const onDone = jest.fn();
    await render(<StatSheet kind="age" form={form()} onChange={noop} onDone={onDone} onClose={noop} />);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    await fireEvent.press(screen.getByText('Done'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/Enter your age/)).toBeNull();
  });

  it('shows the error once a bad value is typed and keeps Done disabled', async () => {
    const onDone = jest.fn();
    await render(<StatSheet kind="age" form={form({ age: '5' })} onChange={noop} onDone={onDone} onClose={noop} />);
    expect(screen.getAllByText(/Age must be a whole number/)).toHaveLength(1);
    await fireEvent.press(screen.getByText('Done'));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('reports typing through onChange and enables Done when valid', async () => {
    const onChange = jest.fn();
    const onDone = jest.fn();
    await render(<StatSheet kind="age" form={form({ age: '31' })} onChange={onChange} onDone={onDone} onClose={noop} />);
    await fireEvent.changeText(screen.getByLabelText('Age'), '32');
    expect(onChange).toHaveBeenCalledWith({ age: '32' });
    await fireEvent.press(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalled();
  });

  it('uses the unit suffix and a decimal keyboard for weight', async () => {
    await render(<StatSheet kind="weight" form={form({ weight: '80' })} onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.getByText('kg')).toBeTruthy();
    expect(screen.getByLabelText('Weight').props.keyboardType).toBe('decimal-pad');
  });

  it('shows feet and inches side by side for imperial height', async () => {
    const onChange = jest.fn();
    await render(<StatSheet kind="height" form={form({ units: 'imperial', heightFt: '5', heightIn: '10' })} onChange={onChange} onDone={noop} onClose={noop} />);
    await fireEvent.changeText(screen.getByLabelText('Inches'), '11');
    expect(onChange).toHaveBeenCalledWith({ heightIn: '11' });
    expect(screen.getByLabelText('Feet')).toBeTruthy();
  });

  it('uses cm for metric height', async () => {
    await render(<StatSheet kind="height" form={form({ heightCm: '178' })} onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.getByText('cm')).toBeTruthy();
    expect(screen.queryByLabelText('Feet')).toBeNull();
  });
});

describe('StatSheet errors and close', () => {
  it('shows one message for an invalid imperial height', async () => {
    await render(<StatSheet kind="height" form={form({ units: 'imperial', heightFt: '5', heightIn: '12' })} onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.getAllByText(/Inches must be from 0 to 11.9/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('flags an invalid metric height', async () => {
    await render(<StatSheet kind="height" form={form({ heightCm: '5000' })} onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.getAllByText('Enter a valid height')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(<StatSheet kind="age" form={form()} onChange={noop} onDone={noop} onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ChoiceSheet', () => {
  it('labels the radio group and closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(<ChoiceSheet kind="activity" visible value={null} onSelect={noop} onClose={onClose} />);
    expect(screen.getByLabelText('How active are you?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('lists Male and Female as radios with the selected one marked and no Done', async () => {
    await render(<ChoiceSheet kind="sex" visible value="FEMALE" onSelect={noop} onClose={noop} />);
    expect(screen.getByRole('radio', { name: 'Female', selected: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Male', selected: false })).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('selects an option with haptics', async () => {
    const onSelect = jest.fn();
    await render(<ChoiceSheet kind="sex" visible value={null} onSelect={onSelect} onClose={noop} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Male' }));
    expect(onSelect).toHaveBeenCalledWith('MALE');
    expect(hapticSelect).toHaveBeenCalled();
  });

  it('lists five activity cards with descriptions', async () => {
    const onSelect = jest.fn();
    await render(<ChoiceSheet kind="activity" visible value="ACTIVE" onSelect={onSelect} onClose={noop} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('Little or no exercise, desk job')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Active,/, selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /^Very active/ }));
    expect(onSelect).toHaveBeenCalledWith('VERY_ACTIVE');
  });

  it('rings the selected card with the accent in light and dark', async () => {
    for (const [scheme, c] of [['light', lightColors], ['dark', darkColors]] as const) {
      mockScheme.mockReturnValue(scheme);
      const { unmount } = await render(<ChoiceSheet kind="activity" visible value="LIGHT" onSelect={noop} onClose={noop} />);
      const style = StyleSheet.flatten(screen.getByRole('radio', { name: /^Lightly active/ }).props.style);
      expect(style).toMatchObject({ borderColor: c.accent, borderWidth: 2, backgroundColor: c.accentSoft, minHeight: 66 });
      const other = StyleSheet.flatten(screen.getByRole('radio', { name: /^Active,/ }).props.style);
      expect(other).toMatchObject({ borderColor: 'transparent', backgroundColor: c.surfaceMuted });
      await unmount();
    }
  });

  it('shows the activity title and has five radios', async () => {
    await render(<ChoiceSheet kind="activity" visible value="LIGHT" onSelect={noop} onClose={noop} />);
    expect(screen.getByRole('header', { name: 'How active are you?' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('renders nothing when hidden', async () => {
    await render(<ChoiceSheet kind="sex" visible={false} value={null} onSelect={noop} onClose={noop} />);
    expect(screen.queryByText('Male')).toBeNull();
  });
});

describe('CustomChangeSheet', () => {
  it('closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(<CustomChangeSheet visible value="" onChange={noop} onDone={noop} onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps Done disabled with no error while empty', async () => {
    const onDone = jest.fn();
    await render(<CustomChangeSheet visible value="" onChange={noop} onDone={onDone} onClose={noop} />);
    await fireEvent.press(screen.getByText('Done'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(/Enter a whole number/)).toBeNull();
  });

  it('shows the range message for an out-of-range or off-step value', async () => {
    await render(<CustomChangeSheet visible value="1200" onChange={noop} onDone={noop} onClose={noop} />);
    expect(screen.getAllByText(/Enter a whole number from 100 to 1000/)).toHaveLength(1);
  });

  it('enables Done for a valid value and reports typing', async () => {
    const onChange = jest.fn();
    const onDone = jest.fn();
    await render(<CustomChangeSheet visible value="400" onChange={onChange} onDone={onDone} onClose={noop} />);
    await fireEvent.changeText(screen.getByLabelText('Calories per day'), '450');
    expect(onChange).toHaveBeenCalledWith('450');
    await fireEvent.press(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalled();
  });
});
