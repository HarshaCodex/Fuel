import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import type { Goals } from '@/api/user';

import { darkColors } from '@/theme';

import { GoalCard } from './GoalCard';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

const goals: Goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70, isAutoCalculated: true, updatedAt: '2026-11-01T00:00:00Z' };

beforeEach(() => {
  mockScheme.mockReturnValue('light');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('GoalCard', () => {
  it('shows calories, chip, tiles with shares and one summary label', async () => {
    await render(<GoalCard goals={goals} onEdit={jest.fn()} />);
    expect(screen.getByText('2,200')).toBeTruthy();
    expect(screen.getByText('kcal')).toBeTruthy();
    expect(screen.getByText('From body stats')).toBeTruthy();
    expect(screen.getByText('150 g')).toBeTruthy();
    expect(screen.getByText('27% of kcal')).toBeTruthy();
    expect(screen.getByText('29% of kcal')).toBeTruthy();
    expect(screen.getByLabelText(/^Daily goal 2,200 calories, from body stats\. Protein 150 grams, 27 percent of calories/)).toBeTruthy();
  });

  it.each([
    [{ updatedAt: null }, 'Default targets'],
    [{ isAutoCalculated: false }, 'Set by you'],
  ])('shows the chip for %j', async (patch, label) => {
    await render(<GoalCard goals={{ ...goals, ...patch }} onEdit={jest.fn()} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows no share text when the calorie goal is 0', async () => {
    await render(<GoalCard goals={{ ...goals, calorieGoal: 0 }} onEdit={jest.fn()} />);
    expect(screen.queryByText(/of kcal/)).toBeNull();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('starts at 0 when counting up', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(0);
    await render(<GoalCard goals={goals} countUp onEdit={jest.fn()} />);
    expect(screen.getByTestId('goal-kcal')).toHaveTextContent('0');
  });

  it('shows the value at once without countUp', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await render(<GoalCard goals={goals} onEdit={jest.fn()} />);
    expect(screen.getByTestId('goal-kcal')).toHaveTextContent('2,200');
  });

  it('opens Edit goals from its own button', async () => {
    const onEdit = jest.fn();
    await render(<GoalCard goals={goals} onEdit={onEdit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit goals' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders in dark mode with the tile fill', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<GoalCard goals={goals} countUp onEdit={jest.fn()} />);
    expect(screen.getByText('2,200')).toBeTruthy();
    const tile = screen.getByText('Protein').parent?.parent;
    expect(StyleSheet.flatten(tile?.props.style).backgroundColor).toBe(darkColors.tileFill);
  });
});
