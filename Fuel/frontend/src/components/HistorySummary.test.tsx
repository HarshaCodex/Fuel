import { render, screen } from '@testing-library/react-native';

import { HistorySummary } from './HistorySummary';

describe('HistorySummary', () => {
  it('shows the average and days on goal', async () => {
    await render(<HistorySummary averageCalories={1980} daysLogged={6} daysOnGoal={4} />);
    expect(screen.getByText('1,980')).toBeOnTheScreen();
    expect(screen.getByText('4 of 6')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avg kcal per logged day, 1,980')).toBeOnTheScreen();
    expect(screen.getByLabelText('Days on goal, 4 of 6')).toBeOnTheScreen();
  });

  it('copes with no logged days', async () => {
    await render(<HistorySummary averageCalories={0} daysLogged={0} daysOnGoal={0} />);
    expect(screen.getByText('0 of 0')).toBeOnTheScreen();
  });
});
