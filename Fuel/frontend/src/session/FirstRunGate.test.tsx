import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

import { getBodyStats } from '@/api/user';
import { getOnboardingSkipped } from '@/lib/tokenStorage';

import { FirstRunGate } from './FirstRunGate';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/api/user', () => ({ ...jest.requireActual('@/api/user'), getBodyStats: jest.fn() }));
jest.mock('@/lib/tokenStorage');

const mockStats = jest.mocked(getBodyStats);
const mockSkipped = jest.mocked(getOnboardingSkipped);
const flush = () => new Promise((r) => setTimeout(r, 20));

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <FirstRunGate />
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSkipped.mockResolvedValue(false);
});

describe('FirstRunGate', () => {
  it('redirects to onboarding when no body stats and not skipped', async () => {
    mockStats.mockResolvedValue(null);
    await mount();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'));
  });

  it('redirects only once even if the query refetches', async () => {
    mockStats.mockResolvedValue(null);
    const qc = await mount();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    await qc.invalidateQueries();
    await flush();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('does not redirect when body stats exist', async () => {
    mockStats.mockResolvedValue({ updatedAt: 'x' } as never);
    await mount();
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSkipped).not.toHaveBeenCalled();
  });

  it('does not redirect after "Set up later"', async () => {
    mockStats.mockResolvedValue(null);
    mockSkipped.mockResolvedValue(true);
    await mount();
    await waitFor(() => expect(mockSkipped).toHaveBeenCalled());
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not block when the fetch fails', async () => {
    mockStats.mockRejectedValue(new Error('offline'));
    await mount();
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not block when the flag cannot be read', async () => {
    mockStats.mockResolvedValue(null);
    mockSkipped.mockRejectedValue(new Error('keychain'));
    await mount();
    await flush();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
