import { fireEvent, render, screen } from '@testing-library/react-native';

import { OAuthButtons } from './OAuthButtons';

describe('OAuthButtons', () => {
  it('calls the matching handler for each button', async () => {
    const onGoogle = jest.fn();
    const onApple = jest.fn();
    await render(<OAuthButtons showApple onGoogle={onGoogle} onApple={onApple} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onGoogle).toHaveBeenCalledTimes(1);
    expect(onApple).toHaveBeenCalledTimes(1);
  });

  it('omits the Apple button unless showApple is set', async () => {
    await render(<OAuthButtons showApple={false} onGoogle={jest.fn()} onApple={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('omits the Google button when showGoogle is false', async () => {
    await render(<OAuthButtons showApple showGoogle={false} onGoogle={jest.fn()} onApple={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeTruthy();
  });

  it('renders nothing, not even the divider, when no provider is available', async () => {
    await render(<OAuthButtons showApple={false} showGoogle={false} onGoogle={jest.fn()} onApple={jest.fn()} />);
    expect(screen.queryByText('or')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables both buttons when disabled', async () => {
    const onGoogle = jest.fn();
    await render(<OAuthButtons disabled showApple onGoogle={onGoogle} onApple={jest.fn()} />);
    const g = screen.getByRole('button', { name: 'Continue with Google' });
    expect(g.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Continue with Apple' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(g);
    expect(onGoogle).not.toHaveBeenCalled();
  });
});
