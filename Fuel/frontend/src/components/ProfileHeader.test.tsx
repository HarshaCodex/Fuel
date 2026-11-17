import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileHeader } from './ProfileHeader';

describe('ProfileHeader', () => {
  it('shows the initial, name and email, each on one line', async () => {
    await render(<ProfileHeader name="Ada Lovelace" email="ada@example.com" onEdit={jest.fn()} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace').props.numberOfLines).toBe(1);
    expect(screen.getByText('ada@example.com').props.numberOfLines).toBe(1);
    expect(screen.getByLabelText('Ada Lovelace, ada@example.com')).toBeTruthy();
  });

  it('falls back to the email initial without a name', async () => {
    await render(<ProfileHeader name="" email="zed@example.com" onEdit={jest.fn()} />);
    expect(screen.getByText('Z')).toBeTruthy();
  });

  it('opens Edit profile from the Edit pill', async () => {
    const onEdit = jest.fn();
    await render(<ProfileHeader name="Ada" email="a@b.co" onEdit={onEdit} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
