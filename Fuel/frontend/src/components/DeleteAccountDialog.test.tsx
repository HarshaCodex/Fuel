import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteAccount, type AuthProvider } from '@/api/user';
import { signInWithApple, signInWithGoogle } from '@/auth/oauthProviders';

import { DeleteAccountDialog } from './DeleteAccountDialog';

jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), deleteAccount: jest.fn() }));
jest.mock('@/auth/oauthProviders', () => ({ signInWithGoogle: jest.fn(), signInWithApple: jest.fn() }));

const mockDelete = jest.mocked(deleteAccount);
const onClose = jest.fn();
const onDeleted = jest.fn();

async function show(provider: AuthProvider = 'EMAIL') {
  await render(<DeleteAccountDialog visible provider={provider} onClose={onClose} onDeleted={onDeleted} />);
}
const typePassword = (v: string) => fireEvent.changeText(screen.getByLabelText('Password'), v);
const pressDelete = () => fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(null);
});

describe('DeleteAccountDialog (email)', () => {
  it('says the deletion is permanent', async () => {
    await show();
    expect(screen.getByText(/permanently deleted/)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
  });

  it('blocks an empty password without a request', async () => {
    await show();
    await pressDelete();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('sends only the password and reports success once', async () => {
    await show();
    await typePassword('secret1!');
    await pressDelete();
    expect(mockDelete).toHaveBeenCalledWith({ password: 'secret1!' });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('shows "Password is incorrect" on 401 and keeps the dialog and the typed password', async () => {
    mockDelete.mockRejectedValue(new ApiError(401, 'bad'));
    await show();
    await typePassword('nope');
    await pressDelete();
    expect(await screen.findByText('Password is incorrect')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the retry-after on 429', async () => {
    mockDelete.mockRejectedValue(new ApiError(429, 'slow', [], 120));
    await show();
    await typePassword('x');
    await pressDelete();
    expect(await screen.findByText('Too many tries. Try again in 2 minutes')).toBeTruthy();
  });

  it('shows an offline message and stays open', async () => {
    mockDelete.mockRejectedValue(new NetworkError());
    await show();
    await typePassword('x');
    await pressDelete();
    expect(await screen.findByText(/You're offline/)).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('shows a generic retry message on 503', async () => {
    mockDelete.mockRejectedValue(new ApiError(503, 'down'));
    await show();
    await typePassword('x');
    await pressDelete();
    expect(await screen.findByText("Couldn't delete your account. Try again.")).toBeTruthy();
  });

  it('shows the server message on 400', async () => {
    mockDelete.mockRejectedValue(new ApiError(400, 'This account uses Sign in with Apple'));
    await show();
    await typePassword('x');
    await pressDelete();
    expect(await screen.findByText('This account uses Sign in with Apple')).toBeTruthy();
  });

  it('shows a not-found message on 404', async () => {
    mockDelete.mockRejectedValue(new ApiError(404, 'gone'));
    await show();
    await typePassword('x');
    await pressDelete();
    expect(await screen.findByText('This account no longer exists.')).toBeTruthy();
  });

  it('disables the buttons and sends one request while in flight', async () => {
    let release: (v: null) => void = () => undefined;
    mockDelete.mockReturnValue(new Promise((r) => { release = r; }));
    await show();
    await typePassword('x');
    await pressDelete();
    await pressDelete();
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => release(null));
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('closes on Cancel and on Android back without a request', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByText('Delete your account?'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountDialog (Google and Apple)', () => {
  it('has no password field and sends the Google token', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue({ idToken: 'g-token' });
    await show('GOOGLE');
    expect(screen.queryByLabelText('Password')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm with Google and delete' }));
    expect(mockDelete).toHaveBeenCalledWith({ googleIdToken: 'g-token' });
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('sends both Apple fields', async () => {
    jest.mocked(signInWithApple).mockResolvedValue({ identityToken: 'a-id', authorizationCode: 'a-code' });
    await show('APPLE');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm with Apple and delete' }));
    expect(mockDelete).toHaveBeenCalledWith({ appleIdentityToken: 'a-id', appleAuthorizationCode: 'a-code' });
  });

  it('sends nothing when Apple returns no authorization code', async () => {
    jest.mocked(signInWithApple).mockResolvedValue({ identityToken: 'a-id' });
    await show('APPLE');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm with Apple and delete' }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(await screen.findByText("Couldn't delete your account. Try again.")).toBeTruthy();
  });

  it.each(['GOOGLE', 'APPLE'] as const)('sends nothing when the %s sheet is cancelled', async (provider) => {
    jest.mocked(signInWithGoogle).mockResolvedValue(null);
    jest.mocked(signInWithApple).mockResolvedValue(null);
    await show(provider);
    await fireEvent.press(screen.getByRole('button', { name: /^Confirm with/ }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('shows an identity message on 401', async () => {
    jest.mocked(signInWithGoogle).mockResolvedValue({ idToken: 'g' });
    mockDelete.mockRejectedValue(new ApiError(401, 'bad'));
    await show('GOOGLE');
    await fireEvent.press(screen.getByRole('button', { name: /^Confirm with/ }));
    expect(await screen.findByText("Couldn't confirm it is you. Try again.")).toBeTruthy();
  });
});
