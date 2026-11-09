import {
  createCustomFood,
  deleteCustomFood,
  foodKeys,
  getCustomFoodPage,
  getFood,
  getFoodByBarcode,
  getFoodPage,
  getRecentFoods,
  updateCustomFood,
} from './food';

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

describe('custom foods', () => {
  const body = { name: 'Oats', servingSize: 40, servingUnit: 'g' as const, calories: 150, protein: 5, carbs: 27, fat: 3 };

  it('has a stable key', () => {
    expect(foodKeys.custom).toEqual(['food', 'custom']);
  });

  it('POSTs the body and unwraps the food', async () => {
    fetchMock.mockImplementation(async () => reply(201, { data: { id: 'c1' } }));
    await expect(createCustomFood(body)).resolves.toEqual({ id: 'c1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/food/custom');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('pages with size 20 by default and sends no q', async () => {
    await getCustomFoodPage(2);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/food/custom?page=2&size=20');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('PUTs the full body to the encoded id', async () => {
    await updateCustomFood('a/b', body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/food/custom/a%2Fb');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it('DELETEs and accepts a 204', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    await expect(deleteCustomFood('c1')).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/food/custom/c1');
    expect(init.method).toBe('DELETE');
  });
});
