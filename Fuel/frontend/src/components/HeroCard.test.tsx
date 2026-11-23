import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { HeroCard } from './HeroCard';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;

beforeEach(() => {
  mockScheme.mockReturnValue('light');
  // Reduce Motion on so the count-up and fill land at once and need no timers.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

const m = (consumed: number, goal: number) => ({ consumed, goal });
const mount = async (calories = m(1450, 2200)) => {
  await render(<HeroCard calories={calories} protein={m(92, 150)} carbs={m(150, 250)} fat={m(40, 70)} />);
  await act(async () => {});
};

describe('HeroCard', () => {
  it('shows calories left, eaten and goal, and the three nutrients', async () => {
    await mount();
    expect(screen.getByText('750')).toBeOnTheScreen();
    expect(screen.getByText('kcal left')).toBeOnTheScreen();
    expect(screen.getByText(/1,450/, { hidden: true })).toBeTruthy();
    expect(screen.getByText(/eaten/, { hidden: true })).toBeTruthy();
    expect(screen.getByText(/2,200/, { hidden: true })).toBeOnTheScreen();
    expect(screen.getByText(/goal/, { hidden: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein, 92 of 150 grams, 58 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carbs, 150 of 250 grams, 100 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fat, 40 of 70 grams, 30 left')).toBeOnTheScreen();
  });

  it('exposes the ring label once, with the eaten and goal line hidden from screen readers', async () => {
    await mount();
    expect(screen.getByLabelText('750 calories remaining. 1,450 of 2,200 eaten.')).toBeOnTheScreen();
    expect(screen.getByText(/eaten/, { hidden: true })).toBeTruthy();
  });

  it('shows the overage in "kcal over" when over goal', async () => {
    await mount(m(2520, 2200));
    expect(screen.getByText('320')).toBeOnTheScreen();
    expect(screen.getByText('kcal over')).toBeOnTheScreen();
    expect(screen.getByLabelText('320 calories over. 2,520 of 2,200 eaten.')).toBeOnTheScreen();
  });

  it('handles an empty day and a goal of 0 without NaN or Infinity', async () => {
    await mount(m(0, 0));
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/NaN|Infinity/);
    await act(async () => {});
    expect(screen.getByTestId('ring-arc')).toBeTruthy();
  });

  it('is a soft shadow card in light mode and a hairline card without shadow in dark mode', async () => {
    await mount();
    const card = () => StyleSheet.flatten(screen.getByText('kcal left').parent?.parent?.parent?.parent?.props.style);
    expect(card().shadowOpacity).toBeGreaterThan(0);
    expect(card().borderWidth).toBeUndefined();
    mockScheme.mockReturnValue('dark');
    await mount();
    const dark = StyleSheet.flatten(screen.getAllByText('kcal left').at(-1)?.parent?.parent?.parent?.parent?.props.style);
    expect(dark.borderWidth).toBe(1);
    expect(dark.shadowOpacity).toBeUndefined();
  });
});
