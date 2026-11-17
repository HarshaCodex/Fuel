import { render, screen } from '@testing-library/react-native';

import { HistorySummaryLine } from './HistorySummaryLine';

describe('HistorySummaryLine', () => {
  it('shows average, days on goal and streak', async () => {
    await render(<HistorySummaryLine averageCalories={2105} daysLogged={12} daysOnGoal={9} streak={4} />);
    expect(screen.getByLabelText('Average 2,105 calories')).toBeTruthy();
    expect(screen.getByLabelText('On goal 9 of 12 days')).toBeTruthy();
    expect(screen.getByLabelText('Streak, 4 days')).toBeTruthy();
  });

  it('hides average and on goal for an empty month', async () => {
    await render(<HistorySummaryLine averageCalories={0} daysLogged={0} daysOnGoal={0} streak={2} />);
    expect(screen.queryByLabelText(/Average/)).toBeNull();
    expect(screen.getByLabelText('Streak, 2 days')).toBeTruthy();
  });

  it('hides the streak at zero', async () => {
    await render(<HistorySummaryLine averageCalories={0} daysLogged={0} daysOnGoal={0} streak={0} />);
    expect(screen.queryByLabelText(/Streak/)).toBeNull();
  });
});
