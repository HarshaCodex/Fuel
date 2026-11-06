import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { forgotPassword, resetPassword } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/errors';
import { clearPendingEmail, getPendingEmail, setPendingEmail } from '@/lib/pendingEmail';

import ResetPassword from './reset-password';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockSignIn = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/api/auth');
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ signIn: mockSignIn }) }));

const mockReset = jest.mocked(resetPassword);
const mockForgot = jest.mocked(forgotPassword);
const EMAIL = 'user@example.com';
const CODE = 'ABC123';
const PASSWORD = 'Str0ng-pass-word!';

const change = (label: string, v: string) => fireEvent.changeText(screen.getByLabelText(label), v);
async function fill(email = EMAIL, code = CODE, password = PASSWORD) {
  await change('Email', email);
  await change('Code', code);
  await change('New password', password);
}
const reset = () => fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
const resendBtn = () => screen.getByRole('button', { name: /^Send a new code/ });
const tick = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  clearPendingEmail();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  clearPendingEmail();
});

describe('ResetPassword', () => {
  it('shows the title and code field props', async () => {
    await render(<ResetPassword />);
    expect(screen.getByRole('header', { name: 'Choose a new password' })).toBeTruthy();
    expect(screen.getByLabelText('Code').props).toMatchObject({
      maxLength: 10,
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'one-time-code',
      textContentType: 'oneTimeCode',
    });
    expect(screen.getByLabelText('New password').props).toMatchObject({
      textContentType: 'newPassword',
      autoComplete: 'new-password',
    });
  });

  it('prefills the email from the pending email', async () => {
    setPendingEmail(EMAIL);
    await render(<ResetPassword />);
    expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
  });

  it('allows an empty email to be typed', async () => {
    await render(<ResetPassword />);
    expect(screen.getByLabelText('Email').props.value).toBe('');
    await change('Email', EMAIL);
    expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
  });

  it('blocks submit for a bad email, blank code or weak password and focuses the first invalid field', async () => {
    const focus = jest.spyOn(RN.TextInput.prototype, 'focus');
    await render(<ResetPassword />);
    // Return-key focus moves give references to the Code and New password inputs.
    await act(async () => screen.getByLabelText('Email').props.onSubmitEditing());
    await act(async () => screen.getByLabelText('Code').props.onSubmitEditing());
    const [codeInput, passwordInput] = focus.mock.contexts;
    focus.mockClear();

    await fill('nope', '  ', 'weak');
    await reset();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter the code.')).toBeTruthy();
    expect(mockReset).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.contexts[0]).not.toBe(codeInput);
    expect(focus.mock.contexts[0]).not.toBe(passwordInput);

    await fill(EMAIL, '  ', 'weak');
    await reset();
    expect(focus.mock.contexts[1]).toBe(codeInput);
  });

  it('blocks a weak password alone', async () => {
    await render(<ResetPassword />);
    await fill(EMAIL, CODE, 'weak');
    await reset();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('resets with trimmed values, stores the email, and replaces to sign in without signing in', async () => {
    mockReset.mockResolvedValue(null);
    await render(<ResetPassword />);
    await fill(`  ${EMAIL} `, ` ${CODE} `);
    await reset();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/sign-in', params: { reset: '1' } }),
    );
    expect(mockReset).toHaveBeenCalledWith(EMAIL, CODE, PASSWORD);
    expect(getPendingEmail()).toBe(EMAIL);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password').props.value).toBe('');
  });

  it('shows a code field error for 401 and keeps the input', async () => {
    mockReset.mockRejectedValue(new ApiError(401, 'x'));
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText("That code didn't work. Request a new one.")).toBeTruthy();
    expect(screen.getByLabelText('Code').props.value).toBe(CODE);
    expect(screen.getByLabelText('New password').props.value).toBe(PASSWORD);
  });

  it('maps 400 field errors to the email and password fields', async () => {
    mockReset.mockRejectedValue(
      new ApiError(400, 'x', [
        { field: 'email', message: 'Email is not valid' },
        { field: 'newPassword', message: 'Password is too common' },
      ]),
    );
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText('Email is not valid')).toBeTruthy();
    expect(screen.getByText('Password is too common')).toBeTruthy();
  });

  it('shows a generic error for 400 without field errors and for other failures', async () => {
    mockReset.mockRejectedValueOnce(new ApiError(400, 'x'));
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText("Couldn't reset your password. Try again.")).toBeTruthy();
    mockReset.mockRejectedValueOnce(new ApiError(500, 'secret server text'));
    await reset();
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Couldn't reset your password. Try again.")).toBeTruthy();
    expect(screen.queryByText(/secret server text/)).toBeNull();
  });

  it('on 429 disables Reset for retryAfter', async () => {
    mockReset.mockRejectedValue(new ApiError(429, 'x', [], 120));
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
    await tick(120000);
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled();
  });

  it('on 429 without retryAfter stays disabled', async () => {
    mockReset.mockRejectedValue(new ApiError(429, 'x'));
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText('Too many tries. Try again in a few minutes')).toBeTruthy();
    await tick(600000);
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  });

  it('shows offline, keeps the input and retries', async () => {
    mockReset.mockRejectedValueOnce(new NetworkError());
    await render(<ResetPassword />);
    await fill();
    await reset();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Code').props.value).toBe(CODE);
    mockReset.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });

  it('sends one request on double tap', async () => {
    let resolve!: (v: null) => void;
    mockReset.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<ResetPassword />);
    await fill();
    const onSubmitEditing = screen.getByLabelText('New password').props.onSubmitEditing;
    await act(async () => {
      onSubmitEditing();
      onSubmitEditing();
    });
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Code').props.editable).toBe(false);
    await act(async () => resolve(null));
  });

  it('uses the return key to move Email -> Code -> New password', async () => {
    const focus = jest.spyOn(RN.TextInput.prototype, 'focus');
    await render(<ResetPassword />);
    await act(async () => screen.getByLabelText('Email').props.onSubmitEditing());
    await act(async () => screen.getByLabelText('Code').props.onSubmitEditing());
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus.mock.contexts[0]).not.toBe(focus.mock.contexts[1]);
  });

  describe('Send a new code', () => {
    it('is disabled with a countdown after arriving from forgot, then enabled', async () => {
      setPendingEmail(EMAIL);
      await render(<ResetPassword />);
      expect(screen.getByText('Send a new code in 0:45')).toBeTruthy();
      expect(resendBtn()).toBeDisabled();
      await tick(45000);
      expect(resendBtn()).toBeEnabled();
      expect(screen.getByText('Send a new code')).toBeTruthy();
    });

    it('needs a valid email and makes no call without one', async () => {
      await render(<ResetPassword />);
      await fireEvent.press(resendBtn());
      expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
      expect(mockForgot).not.toHaveBeenCalled();
    });

    it('shows the same info banner and restarts the cooldown', async () => {
      mockForgot.mockResolvedValue(null);
      await render(<ResetPassword />);
      await change('Email', ` ${EMAIL} `);
      await fireEvent.press(resendBtn());
      expect(await screen.findByText('If an account exists, a new code is on its way.')).toBeTruthy();
      expect(mockForgot).toHaveBeenCalledWith(EMAIL);
      expect(screen.getByText('Send a new code in 0:45')).toBeTruthy();
      expect(resendBtn()).toBeDisabled();
    });

    it('uses retryAfter for the cooldown on 429', async () => {
      mockForgot.mockRejectedValue(new ApiError(429, 'x', [], 90));
      await render(<ResetPassword />);
      await change('Email', EMAIL);
      await fireEvent.press(resendBtn());
      expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
      expect(screen.getByText('Send a new code in 1:30')).toBeTruthy();
    });

    it('shows offline with a Retry that resends', async () => {
      mockForgot.mockRejectedValueOnce(new NetworkError());
      await render(<ResetPassword />);
      await change('Email', EMAIL);
      await fireEvent.press(resendBtn());
      expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
      mockForgot.mockResolvedValueOnce(null);
      await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('If an account exists, a new code is on its way.')).toBeTruthy();
    });
  });

  it('never logs the email, code or password', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m));
    mockReset.mockRejectedValue(new ApiError(401, 'x'));
    await render(<ResetPassword />);
    await fill();
    await reset();
    await screen.findByText("That code didn't work. Request a new one.");
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
