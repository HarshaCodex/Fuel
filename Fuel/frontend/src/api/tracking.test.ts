import { ApiError } from './errors';
import { createEntry, getDashboard, getHistory, trackingKeys } from './tracking';

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

describe('createEntry', () => {
  it('POSTs the body without loggedAt', async () => {
    const body = { foodId: 'f1', servingSize: 150, servingUnit: 'g', quantity: 1, mealLabel: 'lunch' as const };
    await createEntry(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/tracking/entries');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
  });
});

describe('getHistory', () => {
  it('sends from and to and unwraps the list', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: [{ date: '2026-11-09', entryCount: 2 }] }));
    await expect(getHistory('2026-11-03', '2026-11-09')).resolves.toEqual([{ date: '2026-11-09', entryCount: 2 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/tracking/history?from=2026-11-03&to=2026-11-09');
    expect(init.method).toBe('GET');
  });

  it('passes ApiError through', async () => {
    fetchMock.mockResolvedValue(reply(400, { status: 'error', message: 'Range too long' }));
    await expect(getHistory('2026-01-01', '2026-11-09')).rejects.toBeInstanceOf(ApiError);
  });

  it('keys hold only the dates', () => {
    expect(trackingKeys.history('2026-11-03', '2026-11-09')).toEqual(['tracking', 'history', '2026-11-03', '2026-11-09']);
  });
});
