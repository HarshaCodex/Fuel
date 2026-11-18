import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { darkColors } from '@/theme';

import { SetupPanel } from './SetupPanel';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
let mockReduce = true;
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
const goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 240, fatGoal: 70 };
const A11Y = 'Daily goal 2,200 calories, protein 150 grams, carbs 240 grams, fat 70 grams';

beforeEach(() => {
  mockReduce = true;
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
    await screen.unmount();
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
