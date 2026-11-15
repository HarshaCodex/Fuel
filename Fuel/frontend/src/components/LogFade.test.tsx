import { render, screen } from '@testing-library/react-native';

import { LogFade } from './LogFade';

describe('LogFade', () => {
  it('renders without taking touches', async () => {
    await render(<LogFade />);
    expect(screen.getByTestId('log-fade')).toBeTruthy();
  });
});
