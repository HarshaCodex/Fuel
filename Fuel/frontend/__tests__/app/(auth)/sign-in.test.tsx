import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { login, oauthApple, oauthGoogle } from '@/api/auth';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle } from '@/auth/oauthProviders';
import { ApiError, NetworkError } from '@/api/errors';
import { clearPendingEmail, getPendingEmail, setPendingEmail } from '@/lib/pendingEmail';
import { darkColors } from '@/theme';

import SignIn from '../../../app/(auth)/sign-in';

const mockPush = jest.fn();
const mockSignIn = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/api/auth');
jest.mock('@/auth/oauthProviders', () => ({
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  isAppleSignInAvailable: jest.fn().mockResolvedValue(false),
  isGoogleSignInAvailable: jest.fn().mockReturnValue(true),
}));
jest.mock('@/lib/tokenStorage');
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ signIn: mockSignIn }) }));

const mockLogin = jest.mocked(login);
const mockGoogleFlow = jest.mocked(signInWithGoogle);
const mockAppleFlow = jest.mocked(signInWithApple);
const mockOauthGoogle = jest.mocked(oauthGoogle);
const mockOauthApple = jest.mocked(oauthApple);
const mockAppleAvailable = jest.mocked(isAppleSignInAvailable);
const TOKENS = { accessToken: 'a', refreshToken: 'r' } as never;
const EMAIL = 'user@example.com';
const PASSWORD = 'secret-pass';

async function fill(email = EMAIL, password = PASSWORD) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}
// The jest TextInput mock is a class; mock.contexts holds the input instance each focus() ran on.
const focusSpy = () => jest.spyOn(RN.TextInput.prototype, 'focus');
const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  clearPendingEmail();
  mockSignIn.mockResolvedValue(undefined);
  mockAppleAvailable.mockResolvedValue(true);
});

describe('SignIn', () => {
  afterEach(() => jest.restoreAllMocks());

  it('prefills the email from the pending email and clears it', async () => {
    setPendingEmail(EMAIL);
    await render(<SignIn />);
    expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
    expect(getPendingEmail()).toBeNull();
  });

  it('starts empty without a pending email and shows no banner', async () => {
    await render(<SignIn />);
    expect(screen.getByLabelText('Email').props.value).toBe('');
    expect(screen.queryByText('Password updated. Sign in with your new password.')).toBeNull();
  });

  it('shows the password updated banner after a reset', async () => {
    mockParams = { reset: '1' };
    await render(<SignIn />);
    expect(screen.getByText('Password updated. Sign in with your new password.')).toBeTruthy();
  });

  it('signs in with trimmed email and hands tokens to the session', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' } as never);
    await render(<SignIn />);
    await fill(`  ${EMAIL} `);
    await submit();
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' }));
    expect(mockLogin).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it('shows validation errors and does not call the API', async () => {
    await render(<SignIn />);
    await fill('nope', '');
    await submit();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows the credentials error for 401', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'x'));
    await render(<SignIn />);
    await fill();
    await submit();
    expect(await screen.findByText('Email or password is incorrect')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('routes a 403 to verify-email with the typed email and no error', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(403, 'x'));
    await render(<SignIn />);
    await fill(`  ${EMAIL} `);
    await submit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/verify-email', params: { unsent: '1' } }));
    expect(screen.getByLabelText('Password').props.value).toBe('');
    expect(getPendingEmail()).toBe(EMAIL);
    expect(screen.queryByText('Email or password is incorrect')).toBeNull();
  });

  it.each([
    [90, 'Too many tries. Try again in 2 minutes'],
    [60, 'Too many tries. Try again in 1 minute'],
    [undefined, 'Too many tries. Try again in a few minutes'],
  ])('shows the 429 message for retryAfter %s', async (retryAfter, text) => {
    mockLogin.mockRejectedValue(new ApiError(429, 'x', [], retryAfter));
    await render(<SignIn />);
    await fill();
    await submit();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('shows a generic message for other errors', async () => {
    mockLogin.mockRejectedValue(new ApiError(500, 'x'));
    await render(<SignIn />);
    await fill();
    await submit();
    expect(await screen.findByText("Couldn't sign in. Try again.")).toBeTruthy();
  });

  it('shows an offline banner, keeps input and retries', async () => {
    mockLogin.mockRejectedValueOnce(new NetworkError());
    await render(<SignIn />);
    await fill();
    await submit();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
    mockLogin.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockLogin).toHaveBeenCalledTimes(2);
  });

  it('sends one request on double tap and disables fields while loading', async () => {
    let resolve!: (v: never) => void;
    mockLogin.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<SignIn />);
    await fill();
    // Call the handler directly (RNTL skips events on non-editable inputs), so only the in-flight guard stops the second call.
    const onSubmitEditing = screen.getByLabelText('Password').props.onSubmitEditing;
    await act(async () => {
      onSubmitEditing();
      onSubmitEditing();
    });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
    expect(screen.getByLabelText('Password').props.editable).toBe(false);
    await act(async () => resolve({ accessToken: 'a', refreshToken: 'r' } as never));
  });

  it('moves focus on Return and submits from Password', async () => {
    mockLogin.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' } as never);
    await render(<SignIn />);
    await fill();
    const focus = focusSpy();
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(mockLogin).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  });

  it('sets credential-friendly input props', async () => {
    await render(<SignIn />);
    expect(screen.getByLabelText('Email').props).toMatchObject({
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'email',
      textContentType: 'emailAddress',
    });
    expect(screen.getByLabelText('Password').props).toMatchObject({
      secureTextEntry: true,
      autoComplete: 'current-password',
      textContentType: 'password',
    });
  });

  it('navigates to the forgot and register routes', async () => {
    await render(<SignIn />);
    await fireEvent.press(screen.getByRole('button', { name: 'Forgot password?' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/forgot-password');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/register');
  });

  it('does not log the email, password or tokens', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    mockLogin.mockRejectedValue(new ApiError(401, 'x'));
    await render(<SignIn />);
    await fill();
    await submit();
    await screen.findByText('Email or password is incorrect');
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
    spies.forEach((s) => s.mockRestore());
  });

  it('renders in the dark scheme', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    await render(<SignIn />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveStyle({ backgroundColor: darkColors.accent });
  });

  it('focuses the first invalid field after a failed submit', async () => {
    await render(<SignIn />);
    const focus = focusSpy();
    // Return on Email focuses Password, which gives us a reference for "the Password input".
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    const passwordInput = focus.mock.contexts[0];
    focus.mockClear();

    await fill(EMAIL, '');
    await submit();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.contexts[0]).toBe(passwordInput);

    await fill('', '');
    await submit();
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus.mock.contexts[1]).not.toBe(passwordInput);
  });

  it('clears the password error once a password is typed', async () => {
    await render(<SignIn />);
    await fill(EMAIL, '');
    await submit();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'x');
    expect(screen.queryByText('Enter your password.')).toBeNull();
  });
});

describe('SignIn with providers', () => {
  afterEach(() => jest.restoreAllMocks());
  const google = () => screen.getByRole('button', { name: 'Continue with Google' });
  const apple = () => screen.getByRole('button', { name: 'Continue with Apple' });

  it('signs in with Google and passes the tokens to the session', async () => {
    mockGoogleFlow.mockResolvedValue({ idToken: 'gid' });
    mockOauthGoogle.mockResolvedValue(TOKENS);
    await render(<SignIn />);
    await fireEvent.press(google());
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' }));
    expect(mockOauthGoogle).toHaveBeenCalledTimes(1);
    expect(mockOauthGoogle).toHaveBeenCalledWith('gid');
  });

  it('signs in with Apple and forwards the credential', async () => {
    const cred = { identityToken: 'aid', fullName: { givenName: 'A' } };
    mockAppleFlow.mockResolvedValue(cred);
    mockOauthApple.mockResolvedValue(TOKENS);
    await render(<SignIn />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Apple' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockOauthApple).toHaveBeenCalledWith(cred);
  });

  it('is silent when the user cancels', async () => {
    mockGoogleFlow.mockResolvedValue(null);
    await render(<SignIn />);
    await fireEvent.press(google());
    await waitFor(() => expect(mockGoogleFlow).toHaveBeenCalled());
    expect(mockOauthGoogle).not.toHaveBeenCalled();
    expect(screen.queryByText("Couldn't sign in. Try again.")).toBeNull();
    await waitFor(() => expect(google().props.accessibilityState.disabled).toBe(false));
  });

  it('shows the generic message when the provider throws', async () => {
    mockGoogleFlow.mockRejectedValue(new Error('boom'));
    await render(<SignIn />);
    await fireEvent.press(google());
    expect(await screen.findByText("Couldn't sign in. Try again.")).toBeTruthy();
    expect(google().props.accessibilityState.disabled).toBe(false);
  });

  it('shows the generic message for a missing client ID', async () => {
    mockGoogleFlow.mockRejectedValue(new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set'));
    await render(<SignIn />);
    await fireEvent.press(google());
    expect(await screen.findByText("Couldn't sign in. Try again.")).toBeTruthy();
    expect(screen.queryByText(/CLIENT_ID/)).toBeNull();
  });

  it.each([401, 409, 500])('shows the generic message for API %i', async (status) => {
    mockGoogleFlow.mockResolvedValue({ idToken: 'gid' });
    mockOauthGoogle.mockRejectedValue(new ApiError(status, 'x'));
    await render(<SignIn />);
    await fireEvent.press(google());
    expect(await screen.findByText("Couldn't sign in. Try again.")).toBeTruthy();
    expect(screen.queryByText('Email or password is incorrect')).toBeNull();
  });

  it('shows the offline banner and retry re-runs the provider flow', async () => {
    mockGoogleFlow.mockResolvedValue({ idToken: 'gid' });
    mockOauthGoogle.mockRejectedValueOnce(new NetworkError());
    await render(<SignIn />);
    await fireEvent.press(google());
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    mockOauthGoogle.mockResolvedValueOnce(TOKENS);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockOauthGoogle).toHaveBeenCalledTimes(2);
  });

  it('posts once on double tap and disables both buttons mid-flow', async () => {
    let resolve!: (v: { idToken: string } | null) => void;
    mockGoogleFlow.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<SignIn />);
    await screen.findByRole('button', { name: 'Continue with Apple' });
    await fireEvent.press(google());
    await fireEvent.press(google());
    expect(mockGoogleFlow).toHaveBeenCalledTimes(1);
    expect(google().props.accessibilityState.disabled).toBe(true);
    expect(apple().props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockLogin).not.toHaveBeenCalled();
    await act(async () => resolve(null));
  });

  it('hides the Apple button when Apple sign-in is unavailable', async () => {
    mockAppleAvailable.mockResolvedValue(false);
    await render(<SignIn />);
    await waitFor(() => expect(mockAppleAvailable).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(google()).toBeTruthy();
  });
});
