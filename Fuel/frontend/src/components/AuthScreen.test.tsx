import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthScreen } from './AuthScreen';

describe('AuthScreen', () => {
  it('renders children and footer without a back button or title by default', async () => {
    await render(
      <AuthScreen footer={<Text>pinned</Text>}>
        <Text>body</Text>
      </AuthScreen>,
    );
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByText('pinned')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('renders the subtitle only when given', async () => {
    const { rerender } = await render(<AuthScreen title="Check your email">{null}</AuthScreen>);
    expect(screen.queryByText('We sent a code')).toBeNull();
    await rerender(
      <AuthScreen title="Check your email" subtitle="We sent a code">
        {null}
      </AuthScreen>,
    );
    expect(screen.getByText('We sent a code')).toBeTruthy();
    expect(screen.getAllByRole('header')).toHaveLength(1);
  });

  it('shows a labelled Back button that calls onBack, and a header title', async () => {
    const onBack = jest.fn();
    await render(
      <AuthScreen onBack={onBack} title="Create your account">
        <Text>body</Text>
      </AuthScreen>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Create your account' })).toBeTruthy();
  });
});
