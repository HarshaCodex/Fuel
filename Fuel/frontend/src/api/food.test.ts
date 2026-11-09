import { foodKeys, getFood, getFoodByBarcode, getFoodPage, getRecentFoods } from './food';

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => reply(200, { data: [] }));
});

describe('food api', () => {
  it('asks for five recents by default', async () => {
    await expect(getRecentFoods()).resolves.toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/food/recent?limit=5');
    expect(init.method).toBe('GET');
  });

  it('passes a custom limit', async () => {
    await getRecentFoods(12);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/recent?limit=12');
  });

  it('encodes the id in the detail path', async () => {
    await getFood('a/b c');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/a%2Fb%20c');
  });

  it('builds stable keys', () => {
    expect(foodKeys.recent).toEqual(['food', 'recent']);
    expect(foodKeys.search('rice')).toEqual(['food', 'search', 'rice']);
    expect(foodKeys.detail('f1')).toEqual(['food', 'detail', 'f1']);
  });
});

describe('getFoodPage', () => {
  it('encodes the query and paging params', async () => {
    await getFoodPage('mac & cheese', 1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/search?q=mac+%26+cheese&page=1&size=20');
  });
});

describe('getFoodByBarcode', () => {
  it('calls the barcode path and unwraps the food', async () => {
    fetchMock.mockImplementation(async () => reply(200, { data: { id: 'f1' } }));
    await expect(getFoodByBarcode('0123456789012')).resolves.toEqual({ id: 'f1' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/barcode/0123456789012');
  });

  it('encodes the code in the path', async () => {
    await getFoodByBarcode('1/2');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/barcode/1%2F2');
  });
});
