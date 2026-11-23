import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { darkColors, lightColors } from '@/theme';

import { SetupPanel } from './SetupPanel';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: mockBottom, left: 0, right: 0 }) }));
let mockReduce = true;
let mockBottom = 0;
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
const goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 240, fatGoal: 70 };
const A11Y = 'Daily goal 2,200 calories, protein 150 grams, carbs 240 grams, fat 70 grams';

beforeEach(() => {
  mockReduce = true;
  mockBottom = 0;
  mockScheme.mockReturnValue('light');
});
afterEach(() => jest.clearAllMocks());

describe('SetupPanel', () => {
  it('shows only the empty copy and a disabled Start without goals', async () => {
    await render(<SetupPanel onStart={() => {}} />);
    expect(screen.getByText('Fill in the details above to see your goal')).toBeTruthy();
    expect(screen.queryByText('kcal')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start tracking' })).toBeDisabled();
  });

  it('rounds macro grams to whole numbers', async () => {
    await render(<SetupPanel goals={{ ...goals, proteinGoal: 225.9, fatGoal: 50.2 }} onStart={() => {}} />);
    expect(screen.getByText('P 226 g')).toBeTruthy();
    expect(screen.getByText('F 50 g')).toBeTruthy();
  });

  it('shows the goal, macros and a live-region label', async () => {
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    expect(screen.getByText('2,200')).toBeTruthy();
    expect(screen.getByText('P 150 g')).toBeTruthy();
    expect(screen.getByText('C 240 g')).toBeTruthy();
    expect(screen.getByText('F 70 g')).toBeTruthy();
    const summary = screen.getByLabelText(A11Y);
    expect(summary.props.accessibilityLiveRegion).toBe('polite');
  });

  it('dims the summary and disables Start while calculating', async () => {
    await render(<SetupPanel goals={goals} calculating onStart={() => {}} />);
    expect(StyleSheet.flatten(screen.getByLabelText(A11Y).props.style).opacity).toBe(0.5);
    expect(screen.getByRole('button', { name: 'Start tracking' })).toBeDisabled();
    expect(screen.getByText('2,200')).toBeTruthy();
  });

  it('starts on press and respects startDisabled', async () => {
    const onStart = jest.fn();
    await render(<SetupPanel goals={goals} onStart={onStart} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start tracking' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    await screen.rerender(<SetupPanel goals={goals} onStart={onStart} startDisabled />);
    expect(screen.getByRole('button', { name: 'Start tracking' })).toBeDisabled();
  });

  it('shows the new number at once with Reduce Motion, and the empty copy when goals go away', async () => {
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    await screen.rerender(<SetupPanel goals={{ ...goals, calorieGoal: 1950 }} onStart={() => {}} />);
    expect(screen.getByText('1,950')).toBeTruthy();
    await screen.rerender(<SetupPanel onStart={() => {}} />);
    expect(screen.getByText('Fill in the details above to see your goal')).toBeTruthy();
  });

  it('unmounts mid-animation without errors', async () => {
    mockReduce = false;
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    await screen.rerender(<SetupPanel goals={{ ...goals, calorieGoal: 1950 }} onStart={() => {}} />);
    expect(screen.queryByText('1,950')).toBeNull();
    await screen.unmount();
  });

  it('counts from the last shown number after the goal comes back', async () => {
    mockReduce = false;
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    expect(screen.getByText('2,200')).toBeTruthy();
    await screen.rerender(<SetupPanel onStart={() => {}} />);
    await screen.rerender(<SetupPanel goals={goals} onStart={() => {}} />);
    expect(screen.getByText('2,200')).toBeTruthy();
  });

  it('uses the panel shadow and no border in light', async () => {
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    const style = StyleSheet.flatten(screen.getByLabelText(A11Y).parent!.props.style);
    expect(style.shadowOpacity).toBe(0.06);
    expect(style.borderTopWidth).toBeUndefined();
    expect(style.backgroundColor).toBe(lightColors.surface);
  });

  it('pads the bottom by the safe-area inset when larger than 30', async () => {
    mockBottom = 34;
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    expect(StyleSheet.flatten(screen.getByLabelText(A11Y).parent!.props.style).paddingBottom).toBe(34);
  });

  it('uses a hairline top border and no shadow in dark', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<SetupPanel goals={goals} onStart={() => {}} />);
    const panel = screen.getByLabelText(A11Y).parent!;
    const style = StyleSheet.flatten(panel.props.style);
    expect(style.borderColor).toBe(darkColors.border);
    expect(style.shadowOpacity).toBeUndefined();
  });
});
