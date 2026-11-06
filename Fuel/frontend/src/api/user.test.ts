import { ApiError } from './errors';
import { getBodyStats, getGoals, putBodyStats, putGoals, recalculateGoals, userKeys } from './user';

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => reply(200, { data: { ok: 1 } }));
});

const stats = { height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 30, gender: 'MALE', activityLevel: 'LIGHT' } as const;
const goals = { calorieGoal: 2000, proteinGoal: 150, carbGoal: 200, fatGoal: 60 };

describe('user api', () => {
  it('getBodyStats resolves null when data is null', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: null }));
    await expect(getBodyStats()).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/body-stats');
    expect(init.method).toBe('GET');
  });

  it('putBodyStats puts the input to body-stats', async () => {
    await putBodyStats(stats);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/body-stats');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(stats);
  });

  it('getGoals and putGoals use the goals path', async () => {
    await getGoals();
    await putGoals(goals);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/user/goals');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(goals);
  });

  it('recalculateGoals with no input sends no body', async () => {
    await recalculateGoals();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/goals/recalculate');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('recalculateGoals sends the given goal and deficit', async () => {
    await recalculateGoals({ goal: 'LOSE', deficit: 400 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ goal: 'LOSE', deficit: 400 });
  });

  it('surfaces a 400 as an ApiError with field errors', async () => {
    fetchMock.mockResolvedValue(reply(400, { message: 'bad', errors: [{ field: 'age', message: 'too low' }] }));
    const err = await putBodyStats(stats).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual([{ field: 'age', message: 'too low' }]);
  });

  it('keeps query keys free of values', () => {
    expect(userKeys.bodyStats).toEqual(['user', 'bodyStats']);
    expect(userKeys.goals).toEqual(['user', 'goals']);
  });
});
