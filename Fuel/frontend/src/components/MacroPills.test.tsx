import { render, screen } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { lightColors } from '@/theme';

import { MacroPills } from './MacroPills';

const base = {
  protein: { consumed: 120, goal: 165 },
  carbs: { consumed: 200, goal: 250 },
  fat: { consumed: 40, goal: 70 },
};

afterEach(() => jest.restoreAllMocks());

describe('MacroPills', () => {
  it('shows three tiles with labels', async () => {
    await render(<MacroPills {...base} />);
    expect(screen.getByLabelText('Protein, 120 of 165 grams')).toBeTruthy();
    expect(screen.getByLabelText('Carbs, 200 of 250 grams')).toBeTruthy();
    expect(screen.getByLabelText('Fat, 40 of 70 grams')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText(' / 165 g')).toBeTruthy();
  });

  it('fills the bar to the share consumed', async () => {
    await render(<MacroPills {...base} />);
    expect(screen.getByTestId('bar-protein')).toHaveStyle({ width: '73%' });
  });

  it('caps the bar and uses caution text when over goal', async () => {
    await render(<MacroPills {...base} fat={{ consumed: 90, goal: 70 }} />);
    expect(screen.getByTestId('bar-fat')).toHaveStyle({ width: '100%' });
    expect(screen.getByText('90')).toHaveStyle({ color: lightColors.caution });
  });

  it('keeps the bar empty when the goal is 0', async () => {
    await render(<MacroPills {...base} carbs={{ consumed: 10, goal: 0 }} />);
    expect(screen.getByTestId('bar-carbs')).toHaveStyle({ width: '0%' });
    expect(screen.getByLabelText('Carbs, 10 of 0 grams')).toBeTruthy();
  });

  it('stacks at large font scales', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.6);
    await render(<MacroPills {...base} />);
    expect(screen.getByLabelText('Protein, 120 of 165 grams').parent).toHaveStyle({ flexDirection: 'column' });
  });

  it('shows skeletons while loading', async () => {
    await render(<MacroPills {...base} loading />);
    expect(screen.getAllByTestId('macro-skeleton')).toHaveLength(3);
    expect(screen.queryByText('120')).toBeNull();
  });
});
