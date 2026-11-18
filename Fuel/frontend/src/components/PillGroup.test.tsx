import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { hapticSelect } from '@/lib/haptics';
import { darkColors, lightColors } from '@/theme';

import { PillGroup } from './PillGroup';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
const units = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;
const styleOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style) as Record<string, unknown>;

beforeEach(() => mockScheme.mockReturnValue('light'));
afterEach(() => jest.clearAllMocks());

describe('PillGroup', () => {
  it.each(['switch', 'accent'] as const)('renders the %s variant as a radio group with the selection', async (variant) => {
    await render(<PillGroup options={units} value="metric" onChange={() => {}} label="Units" variant={variant} />);
    expect(screen.getByLabelText('Units').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Metric')).toBeSelected();
    expect(screen.getByLabelText('Imperial')).not.toBeSelected();
  });

  it('changes once with a haptic and ignores reselecting', async () => {
    const onChange = jest.fn();
    await render(<PillGroup options={units} value="metric" onChange={onChange} label="Units" />);
    await fireEvent.press(screen.getByLabelText('Metric'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Imperial'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('imperial');
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it('blocks presses when disabled', async () => {
    const onChange = jest.fn();
    await render(<PillGroup options={units} value="metric" onChange={onChange} label="Units" disabled />);
    await fireEvent.press(screen.getByLabelText('Imperial'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Imperial')).toBeDisabled();
  });

  it('uses the muted track in light and a hairline, no shadow, in dark', async () => {
    await render(<PillGroup options={units} value="metric" onChange={() => {}} label="Units" />);
    expect(styleOf('Units').backgroundColor).toBe(lightColors.surfaceMuted);
    await screen.unmount();
    mockScheme.mockReturnValue('dark');
    await render(<PillGroup options={units} value="metric" onChange={() => {}} label="Goal" variant="accent" />);
    expect(styleOf('Goal').borderColor).toBe(darkColors.border);
    expect(styleOf('Goal').shadowOpacity).toBeUndefined();
  });
});
