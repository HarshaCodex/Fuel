import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { apiClient } from '@/api/client';
import * as storage from '@/lib/tokenStorage';

import { SessionProvider, useSession } from './SessionProvider';

jest.mock('@/lib/tokenStorage');
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
});
