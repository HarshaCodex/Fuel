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
