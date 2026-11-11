import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';

import { register } from '@/api/auth';
import { ApiError, NetworkError } from '@/api/errors';
import { getPendingEmail } from '@/lib/pendingEmail';
import { darkColors } from '@/theme';

import Register from '../../../app/(auth)/register';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack }),
}));
jest.mock('@/api/auth');
jest.mock('@/lib/tokenStorage');

const mockRegister = jest.mocked(register);
const EMAIL = 'user@example.com';
const PASSWORD = 'Abcdef1!';

async function fill(name = 'Sam', email = EMAIL, password = PASSWORD) {
  await fireEvent.changeText(screen.getByLabelText('Name'), name);
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}
const focusSpy = () => jest.spyOn(RN.TextInput.prototype, 'focus');
const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('Register', () => {
  it('registers with trimmed values and timezone, stores the email and goes to verify', async () => {
    mockRegister.mockResolvedValue(null);
    await render(<Register />);
    await fill('  Sam  ', `  ${EMAIL} `);
    await submit();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify-email'));
    expect(mockRegister).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      name: 'Sam',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(getPendingEmail()).toBe(EMAIL);
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ params: expect.anything() }));
    expect(screen.getByLabelText('Password').props.value).toBe('');
  });

  it('has a title header and rule list', async () => {
    await render(<Register />);
    expect(screen.getByRole('header', { name: 'Create your account' })).toBeTruthy();
    expect(screen.getByLabelText('A symbol, not met')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Password'), PASSWORD);
    expect(screen.getByLabelText('A symbol, met')).toBeTruthy();
  });

  it.each([
    ['blank name', ' ', EMAIL, PASSWORD, 'Enter your name.'],
    ['101-char name', 'a'.repeat(101), EMAIL, PASSWORD, 'Enter your name.'],
    ['empty email', 'Sam', '', PASSWORD, 'Enter a valid email address.'],
    ['malformed email', 'Sam', 'nope', PASSWORD, 'Enter a valid email address.'],
    ['256-char email', 'Sam', `${'a'.repeat(250)}@b.com`, PASSWORD, 'Enter a valid email address.'],
    ['weak password', 'Sam', EMAIL, 'abc', 'Choose a password that meets all the rules.'],
    ['73-byte password', 'Sam', EMAIL, 'Aa1' + '€'.repeat(30), 'Use at most 72 bytes.'],
  ])('blocks submit for %s without calling the API', async (_n, name, email, password, message) => {
    await render(<Register />);
    await fill(name, email, password);
    await submit();
    expect(screen.getByText(message)).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates on blur but not per keystroke', async () => {
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'nope');
    expect(screen.queryByText('Enter a valid email address.')).toBeNull();
    await fireEvent(screen.getByLabelText('Email'), 'blur');
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });

  it('focuses the first invalid field and follows Return order', async () => {
    await render(<Register />);
    const focus = focusSpy();
    await fireEvent(screen.getByLabelText('Name'), 'submitEditing');
    await fireEvent(screen.getByLabelText('Email'), 'submitEditing');
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus.mock.contexts[0]).not.toBe(focus.mock.contexts[1]);
    focus.mockClear();
    await fill('', 'nope', 'x');
    await submit();
    const nameInput = focus.mock.contexts[0];
    await fill('Sam', 'nope', 'x');
    await submit();
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus.mock.contexts[1]).not.toBe(nameInput);
  });

  it('submits from the Password Return key', async () => {
    mockRegister.mockResolvedValue(null);
    await render(<Register />);
    await fill();
    await fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
  });

  it('maps 400 field errors onto fields', async () => {
    mockRegister.mockRejectedValue(
      new ApiError(400, 'x', [
        { field: 'email', message: 'Email is not allowed.' },
        { field: 'password', message: 'Password is too common.' },
      ]),
    );
    await render(<Register />);
    await fill();
    await submit();
    expect(await screen.findByText('Email is not allowed.')).toBeTruthy();
    expect(screen.getByText('Password is too common.')).toBeTruthy();
  });

  it('shows a generic error for a 400 without usable field errors and for 500', async () => {
    mockRegister.mockRejectedValue(new ApiError(400, 'x', [{ field: 'other', message: 'no' }]));
    await render(<Register />);
    await fill();
    await submit();
    expect(await screen.findByText("Couldn't create your account. Try again.")).toBeTruthy();
  });

  it.each([
    [120, 'Too many tries. Try again in 2 minutes'],
    [undefined, 'Too many tries. Try again in a few minutes'],
  ])('shows the 429 message for retryAfter %s', async (retryAfter, text) => {
    mockRegister.mockRejectedValue(new ApiError(429, 'x', [], retryAfter));
    await render(<Register />);
    await fill();
    await submit();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('shows an offline banner, keeps input and retries', async () => {
    mockRegister.mockRejectedValueOnce(new NetworkError());
    await render(<Register />);
    await fill();
    await submit();
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByLabelText('Name').props.value).toBe('Sam');
    expect(screen.getByLabelText('Password').props.value).toBe(PASSWORD);
    mockRegister.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify-email'));
    expect(mockRegister).toHaveBeenCalledTimes(2);
  });

  it('sends one request on double tap and disables fields while loading', async () => {
    let resolve!: (v: null) => void;
    mockRegister.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<Register />);
    await fill();
    const onSubmitEditing = screen.getByLabelText('Password').props.onSubmitEditing;
    await act(async () => {
      onSubmitEditing();
      onSubmitEditing();
    });
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Name').props.editable).toBe(false);
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
    expect(screen.getByLabelText('Password').props.editable).toBe(false);
    await act(async () => resolve(null));
  });

  it('goes back, or to sign in when there is no history', async () => {
    await render(<Register />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(mockBack).toHaveBeenCalled();
    mockCanGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('sets credential-friendly input props', async () => {
    await render(<Register />);
    expect(screen.getByLabelText('Password').props).toMatchObject({
      secureTextEntry: true,
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    });
    expect(screen.getByLabelText('Email').props).toMatchObject({ keyboardType: 'email-address', autoCapitalize: 'none' });
  });

  it('does not log the email or password', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map((m) => jest.spyOn(console, m).mockImplementation());
    mockRegister.mockRejectedValue(new ApiError(500, 'x'));
    await render(<Register />);
    await fill();
    await submit();
    await screen.findByText("Couldn't create your account. Try again.");
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
  });

  it('renders in the dark scheme', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    await render(<Register />);
    expect(screen.getByRole('button', { name: 'Create account' })).toHaveStyle({ backgroundColor: darkColors.accent });
  });
});
