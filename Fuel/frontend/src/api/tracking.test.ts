import { ApiError } from './errors';
import { getDashboard, trackingKeys } from './tracking';

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => reply(200, { data: { date: '2026-11-03' } }));
});

describe('tracking api', () => {
  it('omits the query for today', async () => {
    await getDashboard();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/tracking/dashboard');
    expect(init.method).toBe('GET');
  });

  it('carries the date in the path', async () => {
    await expect(getDashboard('2026-11-03')).resolves.toEqual({ date: '2026-11-03' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/tracking/dashboard?date=2026-11-03');
  });

  it('passes ApiError through', async () => {
    fetchMock.mockResolvedValue(reply(404, { status: 'error', message: 'User not found' }));
    await expect(getDashboard()).rejects.toBeInstanceOf(ApiError);
  });

  it('keys hold only the date', () => {
    expect(trackingKeys.dashboard()).toEqual(['tracking', 'dashboard', 'today']);
    expect(trackingKeys.dashboard('2026-11-03')).toEqual(['tracking', 'dashboard', '2026-11-03']);
  });
});
