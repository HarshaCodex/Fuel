import { apiClient } from './client';
import type { FoodSource } from './tracking';

export type Food = {
  id: string;
  name: string;
  brand: string | null;
  source: FoodSource;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};
export type RecentFood = Food & { lastLoggedAt: string };

/** Keys hold ids and the search term only; no tokens or nutrition values. */
export const foodKeys = {
  search: (q: string) => ['food', 'search', q] as const,
  recent: ['food', 'recent'] as const,
  detail: (id: string) => ['food', 'detail', id] as const,
};

/** The backend allows 1..30 and defaults to 10. */
export const getRecentFoods = (limit = 5): Promise<RecentFood[]> =>
  apiClient.request<RecentFood[]>('GET', `/api/food/recent?${new URLSearchParams({ limit: String(limit) })}`);

export const getFood = (id: string): Promise<Food> =>
  apiClient.request<Food>('GET', `/api/food/${encodeURIComponent(id)}`);

export type FoodPage = { content: Food[]; page: number; size: number; totalElements: number; totalPages: number };

/** The backend needs a 2..100 character `q` and allows 30 searches a minute. */
export const getFoodPage = (q: string, page = 0, size = 20): Promise<FoodPage> =>
  apiClient.request<FoodPage>('GET', `/api/food/search?${new URLSearchParams({ q, page: String(page), size: String(size) })}`);
