import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { resendVerification, verifyEmail } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/errors';
import { clearPendingEmail, setPendingEmail } from '@/lib/pendingEmail';
import { darkColors } from '@/theme';

import VerifyEmail from './verify-email';

const mockReplace = jest.fn();
const mockSignIn = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/api/auth');
jest.mock('@/lib/tokenStorage');
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ signIn: mockSignIn }) }));

const mockVerify = jest.mocked(verifyEmail);
const mockResend = jest.mocked(resendVerification);
const EMAIL = 'user@example.com';
const CODE = 'ABC123';

const typeCode = (v = CODE) => fireEvent.changeText(screen.getByLabelText('Code'), v);
const verify = () => fireEvent.press(screen.getByRole('button', { name: 'Verify' }));
const tick = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
const resendBtn = () => screen.getByRole('button', { name: /^Resend/ });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  setPendingEmail(EMAIL);
  mockSignIn.mockResolvedValue(undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  clearPendingEmail();
});

describe('VerifyEmail', () => {
  it('shows the title and where the code was sent', async () => {
    await render(<VerifyEmail />);
    expect(screen.getByRole('header', { name: 'Check your email' })).toBeTruthy();
    expect(screen.getByText(`We sent a code to ${EMAIL}`)).toBeTruthy();
    expect(screen.getByLabelText('Code').props).toMatchObject({
      maxLength: 10,
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'one-time-code',
      textContentType: 'oneTimeCode',
    });
  });

  it('redirects to sign in when there is no pending email', async () => {
    clearPendingEmail();
    await render(<VerifyEmail />);
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    expect(screen.queryByLabelText('Code')).toBeNull();
  });

  it('verifies a trimmed code and signs in with exactly the two tokens', async () => {
    mockVerify.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', extra: 1 } as never);
    await render(<VerifyEmail />);
    await typeCode(`  ${CODE} `);
    await verify();
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' }));
    expect(mockVerify).toHaveBeenCalledWith(EMAIL, CODE);
  });

  it('asks for a code without calling the API', async () => {
    await render(<VerifyEmail />);
    await typeCode('  ');
    await verify();
    expect(screen.getByText('Enter the code.')).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('shows a field error for 401 and keeps the code', async () => {
    mockVerify.mockRejectedValue(new ApiError(401, 'x'));
    await render(<VerifyEmail />);
    await typeCode();
    await verify();
    expect(await screen.findByText("That code didn't work. Check it or request a new one.")).toBeTruthy();
    expect(screen.getByLabelText('Code').props.value).toBe(CODE);
  });

  it('on 429 shows the message and disables Verify and Resend for retryAfter', async () => {
    mockVerify.mockRejectedValue(new ApiError(429, 'x', [], 120));
    await render(<VerifyEmail />);
    await tick(45000); // let the initial resend cooldown finish
    await typeCode();
    await verify();
    expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(resendBtn()).toBeDisabled();
    await tick(120000);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
    expect(resendBtn()).toBeEnabled();
  });

  it('on 429 without retryAfter stays disabled', async () => {
    mockVerify.mockRejectedValue(new ApiError(429, 'x'));
    await render(<VerifyEmail />);
    await typeCode();
    await verify();
    expect(await screen.findByText('Too many tries. Try again in a few minutes')).toBeTruthy();
    await tick(600000);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(resendBtn()).toBeDisabled();
  });

  it('shows an offline banner, keeps the code and retries', async () => {
    mockVerify.mockRejectedValueOnce(new NetworkError());
    await render(<VerifyEmail />);
    await typeCode();
    await verify();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Code').props.value).toBe(CODE);
    mockVerify.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
  });

  it('shows a generic error for other failures', async () => {
    mockVerify.mockRejectedValue(new ApiError(500, 'x'));
    await render(<VerifyEmail />);
    await typeCode();
    await verify();
    expect(await screen.findByText("Couldn't verify. Try again.")).toBeTruthy();
  });

  it('sends one request on double tap and disables the field while loading', async () => {
    let resolve!: (v: never) => void;
    mockVerify.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<VerifyEmail />);
    await typeCode();
    const onSubmitEditing = screen.getByLabelText('Code').props.onSubmitEditing;
    await act(async () => {
      onSubmitEditing();
      onSubmitEditing();
    });
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Code').props.editable).toBe(false);
    await act(async () => resolve({ accessToken: 'a', refreshToken: 'r' } as never));
  });

  describe('resend cooldown', () => {
    it('starts at 0:45, counts down and enables at zero', async () => {
      await render(<VerifyEmail />);
      expect(resendBtn()).toHaveTextContent('Resend in 0:45');
      expect(resendBtn()).toBeDisabled();
      await tick(1000);
      expect(resendBtn()).toHaveTextContent('Resend in 0:44');
      await tick(44000);
      expect(resendBtn()).toHaveTextContent('Resend code');
      expect(resendBtn()).toBeEnabled();
    });

    it('resends, restarts the cooldown and shows an info banner', async () => {
      mockResend.mockResolvedValue({ emailVerified: false });
      await render(<VerifyEmail />);
      await tick(45000);
      await fireEvent.press(resendBtn());
      expect(await screen.findByText('A new code is on its way.')).toBeTruthy();
      expect(mockResend).toHaveBeenCalledWith(EMAIL);
      expect(resendBtn()).toHaveTextContent('Resend in 0:45');
    });

    it('uses retryAfter from a 429', async () => {
      mockResend.mockRejectedValue(new ApiError(429, 'x', [], 30));
      await render(<VerifyEmail />);
      await tick(45000);
      await fireEvent.press(resendBtn());
      expect(await screen.findByText('Too many tries. Try again in 1 minute')).toBeTruthy();
      expect(resendBtn()).toHaveTextContent('Resend in 0:30');
    });

    it('falls back to the default cooldown on a 429 without retryAfter', async () => {
      mockResend.mockRejectedValue(new ApiError(429, 'x'));
      await render(<VerifyEmail />);
      await tick(45000);
      await fireEvent.press(resendBtn());
      await screen.findByText('Too many tries. Try again in a few minutes');
      expect(resendBtn()).toHaveTextContent('Resend in 0:45');
    });

    it('does not warn about state updates after unmount', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation();
      const view = await render(<VerifyEmail />);
      await view.unmount();
      await tick(60000);
      expect(error).not.toHaveBeenCalled();
    });
  });

  it('does not log the email, code or tokens', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    mockVerify.mockRejectedValue(new ApiError(401, 'x'));
    await render(<VerifyEmail />);
    await typeCode();
    await verify();
    await screen.findByText("That code didn't work. Check it or request a new one.");
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(CODE);
  });

  it('renders in the dark scheme', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    await render(<VerifyEmail />);
    expect(screen.getByRole('button', { name: 'Verify' })).toHaveStyle({ backgroundColor: darkColors.accent });
  });
});
