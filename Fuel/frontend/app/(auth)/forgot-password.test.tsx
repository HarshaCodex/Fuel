import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { forgotPassword } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/errors';
import { clearPendingEmail, getPendingEmail } from '@/lib/pendingEmail';

import ForgotPassword from './forgot-password';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockRouter = { push: mockPush, back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/api/auth');

const mockForgot = jest.mocked(forgotPassword);
const EMAIL = 'user@example.com';
const SENT = 'If an account exists, a code is on its way';

const typeEmail = (v = EMAIL) => fireEvent.changeText(screen.getByLabelText('Email'), v);
const send = () => fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

beforeEach(() => {
  jest.clearAllMocks();
  clearPendingEmail();
  mockCanGoBack.mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('ForgotPassword', () => {
  it('shows the title, callout and email field props', async () => {
    await render(<ForgotPassword />);
    expect(screen.getByRole('header', { name: 'Reset your password' })).toBeTruthy();
    expect(screen.getByText("Enter your email and we'll send a code")).toBeTruthy();
    expect(screen.getByLabelText('Email').props).toMatchObject({
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'email',
      textContentType: 'emailAddress',
    });
  });

  it('rejects an invalid email without calling the API and focuses the field', async () => {
    const focus = jest.spyOn(RN.TextInput.prototype, 'focus');
    await render(<ForgotPassword />);
    await typeEmail('nope');
    await send();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(mockForgot).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });

  it('rejects an empty email without calling the API', async () => {
    await render(<ForgotPassword />);
    await send();
    expect(mockForgot).not.toHaveBeenCalled();
  });

  it('sends the trimmed email and shows the same confirmation copy', async () => {
    mockForgot.mockResolvedValue(null);
    await render(<ForgotPassword />);
    await typeEmail(`  ${EMAIL} `);
    await send();
    expect(await screen.findByText(SENT)).toBeTruthy();
    expect(mockForgot).toHaveBeenCalledWith(EMAIL);
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('Enter code stores the email in memory and opens reset without params', async () => {
    mockForgot.mockResolvedValue(null);
    await render(<ForgotPassword />);
    await typeEmail(`  ${EMAIL} `);
    await send();
    await fireEvent.press(await screen.findByRole('button', { name: 'Enter code' }));
    expect(getPendingEmail()).toBe(EMAIL);
    expect(mockPush).toHaveBeenCalledWith('/reset-password');
  });

  it('goes back, falling back to sign in when there is no history', async () => {
    await render(<ForgotPassword />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(mockBack).toHaveBeenCalled();
    mockCanGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('shows the rate limit message with and without retryAfter', async () => {
    mockForgot.mockRejectedValueOnce(new ApiError(429, 'x', [], 120));
    await render(<ForgotPassword />);
    await typeEmail();
    await send();
    expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
    mockForgot.mockRejectedValueOnce(new ApiError(429, 'x'));
    await send();
    expect(await screen.findByText('Too many tries. Try again in a few minutes')).toBeTruthy();
  });

  it('shows offline, keeps the input and retries', async () => {
    mockForgot.mockRejectedValueOnce(new NetworkError());
    await render(<ForgotPassword />);
    await typeEmail();
    await send();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
    mockForgot.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(SENT)).toBeTruthy();
    expect(mockForgot).toHaveBeenCalledTimes(2);
  });

  it('shows a generic error and never the server message', async () => {
    mockForgot.mockRejectedValue(new ApiError(500, 'secret server text'));
    await render(<ForgotPassword />);
    await typeEmail();
    await send();
    expect(await screen.findByText("Couldn't send a code. Try again.")).toBeTruthy();
    expect(screen.queryByText(/secret server text/)).toBeNull();
  });

  it('sends one request on double tap', async () => {
    let resolve!: (v: null) => void;
    mockForgot.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<ForgotPassword />);
    await typeEmail();
    const onSubmitEditing = screen.getByLabelText('Email').props.onSubmitEditing;
    await act(async () => {
      onSubmitEditing();
      onSubmitEditing();
    });
    expect(mockForgot).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
    await act(async () => resolve(null));
    await waitFor(() => expect(screen.getByText(SENT)).toBeTruthy());
  });

  it('logs nothing', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m));
    mockForgot.mockResolvedValue(null);
    await render(<ForgotPassword />);
    await typeEmail();
    await send();
    await screen.findByText(SENT);
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
