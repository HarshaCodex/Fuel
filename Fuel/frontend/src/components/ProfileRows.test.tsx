import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileRows } from './ProfileRows';

const props = { appearance: 'System', onMyFoods: jest.fn(), onAppearance: jest.fn(), onSignOut: jest.fn() };

describe('ProfileRows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the row accessibility labels and shows the My Foods count', async () => {
    await render(<ProfileRows {...props} customFoods="5" />);
    expect(screen.getByRole('button', { name: 'My Foods' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Appearance. System' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows no count while it is unknown', async () => {
    await render(<ProfileRows {...props} />);
    expect(screen.queryByText('5')).toBeNull();
    expect(screen.getByText('My Foods')).toBeTruthy();
  });

  it('calls the matching handler once per press', async () => {
    await render(<ProfileRows {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'My Foods' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Appearance. System' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(props.onMyFoods).toHaveBeenCalledTimes(1);
    expect(props.onAppearance).toHaveBeenCalledTimes(1);
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });
});
