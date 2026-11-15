import { fireEvent, render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import type { Food } from '@/api/food';
import { hapticSelect } from '@/lib/haptics';
import { darkColors, lightColors } from '@/theme';

import { PortionTiles } from './PortionTiles';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ default: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ hapticSelect: jest.fn() }));

const food: Food = { id: 'f', name: 'Chicken', brand: null, source: 'USDA', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6 };

const mockScheme = jest.requireMock('react-native/Libraries/Utilities/useColorScheme').default as jest.Mock;
const tileOf = (label: string) => screen.getByLabelText(label);

beforeEach(() => mockScheme.mockReturnValue('light'));
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('PortionTiles', () => {
  it('renders four radios in a Portion group with labels', async () => {
    await render(<PortionTiles food={food} selected="one" onSelect={() => {}} />);
    expect(screen.getByLabelText('Portion').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByLabelText('50 g, ½ serving')).toBeTruthy();
    expect(screen.getByLabelText('100 g, 1 serving')).toBeTruthy();
    expect(screen.getByLabelText('150 g, 1½ servings')).toBeTruthy();
    expect(screen.getByLabelText('Custom, type amount')).toBeTruthy();
  });

  it('marks only the selected tile', async () => {
    await render(<PortionTiles food={food} selected="one" onSelect={() => {}} />);
    expect(screen.getByLabelText('100 g, 1 serving')).toBeSelected();
    expect(screen.getByLabelText('50 g, ½ serving')).not.toBeSelected();
  });

  it('selects with a haptic tick, but not when re-tapping the selected tile', async () => {
    const onSelect = jest.fn();
    await render(<PortionTiles food={food} selected="one" onSelect={onSelect} />);
    await fireEvent.press(screen.getByLabelText('100 g, 1 serving'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(hapticSelect).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Custom, type amount'));
    expect(onSelect).toHaveBeenCalledWith('custom');
    expect(hapticSelect).toHaveBeenCalledTimes(1);
  });

  it('shows the food unit as is', async () => {
    await render(<PortionTiles food={{ ...food, servingSize: 1, servingUnit: 'cup' }} selected="one" onSelect={() => {}} />);
    expect(screen.getByLabelText('½ cup, ½ serving')).toBeTruthy();
    expect(screen.getByLabelText('1½ cup, 1½ servings')).toBeTruthy();
  });

  it('wraps into a grid at large text sizes', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    await render(<PortionTiles food={food} selected="one" onSelect={() => {}} />);
    expect(screen.getByLabelText('Portion')).toHaveStyle({ flexWrap: 'wrap' });
  });

  it('fills the selected tile with the accent and leaves the others on the surface', async () => {
    await render(<PortionTiles food={food} selected="one" onSelect={() => {}} />);
    expect(tileOf('100 g, 1 serving')).toHaveStyle({ backgroundColor: lightColors.accent });
    expect(tileOf('50 g, ½ serving')).toHaveStyle({ backgroundColor: lightColors.surface });
  });

  it('uses a hairline instead of a shadow in dark mode', async () => {
    mockScheme.mockReturnValue('dark');
    await render(<PortionTiles food={food} selected="one" onSelect={() => {}} />);
    expect(tileOf('50 g, ½ serving')).toHaveStyle({ borderWidth: 1, borderColor: darkColors.border });
    expect(tileOf('100 g, 1 serving')).toHaveStyle({ backgroundColor: darkColors.accent });
  });
});
