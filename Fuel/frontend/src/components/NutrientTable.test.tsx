import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { darkColors, lightColors } from '@/theme';

import { NutrientTable } from './NutrientTable';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
beforeEach(() => mockScheme.mockReturnValue('light'));

const m = (consumed: number, goal: number) => ({ consumed, goal });
const width = (key: string) => StyleSheet.flatten(screen.getByTestId(`bar-${key}`).props.style).width;

describe('NutrientTable', () => {
  it('shows each nutrient with eaten, goal and left, and a spoken label', async () => {
    await render(<NutrientTable protein={m(92, 150)} carbs={m(150, 250)} fat={m(40, 70)} />);
    expect(screen.getByText('92 g')).toBeOnTheScreen();
    expect(screen.getAllByText('150 g')).toHaveLength(2); // protein goal and carbs eaten
    expect(screen.getByText('58 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein, 92 of 150 grams, 58 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carbs, 150 of 250 grams, 100 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fat, 40 of 70 grams, 30 left')).toBeOnTheScreen();
    expect(screen.getByText('Nutrient', { hidden: true })).toBeOnTheScreen();
  });

  it('fills each bar to its share of the goal', async () => {
    await render(<NutrientTable protein={m(75, 150)} carbs={m(0, 250)} fat={m(70, 70)} />);
    expect(width('protein')).toBe('50%');
    expect(width('carbs')).toBe('0%');
    expect(width('fat')).toBe('100%');
  });

  it('shows "N over" in the caution colour and caps the bar at full when over goal', async () => {
    await render(<NutrientTable protein={m(180, 150)} carbs={m(10, 250)} fat={m(10, 70)} />);
    const over = screen.getByText('30 over');
    expect(StyleSheet.flatten(over.props.style).color).toBe(lightColors.caution);
    expect(screen.getByLabelText('Protein, 180 of 150 grams, 30 over')).toBeOnTheScreen();
    expect(width('protein')).toBe('100%');
    expect(screen.getByText('240 g')).toBeOnTheScreen();
  });

  it('shows 0 left (not a negative) and no over at exactly the goal', async () => {
    await render(<NutrientTable protein={m(150, 150)} carbs={m(10, 250)} fat={m(10, 70)} />);
    expect(screen.getByLabelText('Protein, 150 of 150 grams, 0 left')).toBeOnTheScreen();
    expect(screen.getByText('0 g')).toBeOnTheScreen();
    expect(screen.queryByText(/over/)).toBeNull();
  });

  it('survives a goal of 0 with no NaN or Infinity anywhere', async () => {
    await render(<NutrientTable protein={m(0, 0)} carbs={m(5, 0)} fat={m(0, 0)} />);
    expect(width('protein')).toBe('0%');
    expect(width('carbs')).toBe('0%');
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/NaN|Infinity/);
    expect(screen.getByLabelText('Carbs, 5 of 0 grams, 0 left')).toBeOnTheScreen();
  });

  it('rounds fractional grams the way the rest of the app does', async () => {
    await render(<NutrientTable protein={m(92.4, 150)} carbs={m(1, 2)} fat={m(1, 2)} />);
    expect(screen.getByLabelText(/^Protein, 92(\.4)? of 150 grams, /)).toBeOnTheScreen();
  });

  it('uses the dark palette in dark mode', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<NutrientTable protein={m(180, 150)} carbs={m(10, 250)} fat={m(10, 70)} />);
    expect(StyleSheet.flatten(screen.getByText('30 over').props.style).color).toBe(darkColors.caution);
    expect(StyleSheet.flatten(screen.getByTestId('bar-carbs').props.style).backgroundColor).toBe(darkColors.carbs);
  });
});
