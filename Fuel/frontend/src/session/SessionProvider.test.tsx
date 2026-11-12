import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Appearance, Text } from 'react-native';

import { apiClient } from '@/api/client';
import * as storage from '@/lib/tokenStorage';

import { SessionProvider, useSession } from './SessionProvider';

jest.mock('@/lib/tokenStorage');
jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn(), getItem: jest.fn(), setItem: jest.fn() }));
const mocked = jest.mocked(storage);
const fetchMock = jest.fn();

const latest: { session?: ReturnType<typeof useSession> } = {};
function Probe() {
  const session = useSession();
  useEffect(() => {
    latest.session = session;
  });
  return <Text>{session.status}</Text>;
}

async function mount() {
  const qc = new QueryClient();
  qc.setQueryData(['meals'], [1]);
  await render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  jest.resetAllMocks();
  globalThis.fetch = fetchMock;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  mocked.getTokens.mockResolvedValue(null);
});

describe('SessionProvider', () => {
  it('starts loading then signedOut without tokens', async () => {
    await mount();
    expect(await screen.findByText('signedOut')).toBeTruthy();
  });

  it('is signedIn with stored tokens', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    await mount();
    expect(await screen.findByText('signedIn')).toBeTruthy();
  });

  it('signIn persists tokens and flips status', async () => {
    await mount();
    await screen.findByText('signedOut');
    await act(() => latest.session!.signIn({ accessToken: 'a', refreshToken: 'r' }));
    expect(mocked.setTokens).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' });
    expect(screen.getByText('signedIn')).toBeTruthy();
  });

  it('signOut clears tokens and cache even if logout rejects', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const qc = await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    expect(mocked.clearTokens).toHaveBeenCalled();
    expect(qc.getQueryData(['meals'])).toBeUndefined();
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('signOut leaves the appearance override alone', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    expect(screen.getByText('signedOut')).toBeTruthy();
    expect(setScheme).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('fuel.appearance');
    setScheme.mockRestore();
  });

  it('signOut does not wait for a hanging logout request', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockReturnValue(new Promise(() => undefined));
    await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('signOut sends logout with the captured bearer and refresh token body', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockResolvedValue(new Response('{"data":null}', { status: 200 }));
    await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://api.test/api/auth/logout');
    expect(init.headers.Authorization).toBe('Bearer a');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'r' });
  });

  it('signOut retries logout once with a rotated pair when the access token has expired', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"data":{"accessToken":"a2","refreshToken":"r2"}}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"data":null}', { status: 200 }));
    await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, refreshInit] = fetchMock.mock.calls[1];
    expect(String(fetchMock.mock.calls[1][0])).toBe('http://api.test/api/auth/refresh');
    expect(refreshInit.headers.Authorization).toBeUndefined();
    expect(JSON.parse(refreshInit.body)).toEqual({ refreshToken: 'r' });
    const [url, init] = fetchMock.mock.calls[2];
    expect(String(url)).toBe('http://api.test/api/auth/logout');
    expect(init.headers.Authorization).toBe('Bearer a2');
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'r2' });
    expect(mocked.setTokens).not.toHaveBeenCalled();
  });

  it('signOut still ends the session when storage throws', async () => {
    mocked.getTokens.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    await mount();
    await screen.findByText('signedIn');
    mocked.getTokens.mockRejectedValue(new Error('keychain'));
    mocked.clearTokens.mockRejectedValue(new Error('keychain'));
    await act(() => latest.session!.signOut());
    expect(screen.getByText('signedOut')).toBeTruthy();
  });

  it('session expiry signs out locally without calling logout', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    fetchMock.mockImplementation(async () => new Response('{}', { status: 401 }));
    const qc = await mount();
    await screen.findByText('signedIn');
    await act(() => apiClient.request('GET', '/api/x').catch(() => undefined));
    await waitFor(() => expect(screen.getByText('signedOut')).toBeTruthy());
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/logout'))).toBe(false);
    expect(qc.getQueryData(['meals'])).toBeUndefined();
  });

  it('clears the onboarding skip flag on sign-out and on expiry, even if clearing fails', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    mocked.clearOnboardingSkipped.mockRejectedValue(new Error('keychain'));
    fetchMock.mockImplementation(async () => new Response('{}', { status: 401 }));
    await mount();
    await screen.findByText('signedIn');
    await act(() => latest.session!.signOut());
    expect(mocked.clearOnboardingSkipped).toHaveBeenCalledTimes(1);
    expect(screen.getByText('signedOut')).toBeTruthy();
  });
});
