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
  custom: ['food', 'custom'] as const,
};

/** The backend allows 1..30 and defaults to 10. */
export const getRecentFoods = (limit = 5): Promise<RecentFood[]> =>
  apiClient.request<RecentFood[]>('GET', `/api/food/recent?${new URLSearchParams({ limit: String(limit) })}`);

export const getFood = (id: string): Promise<Food> =>
  apiClient.request<Food>('GET', `/api/food/${encodeURIComponent(id)}`);

/** The backend accepts 8 to 14 digits. 404 means unknown, 400 a bad format. Not cached: the code is not a key. */
export const getFoodByBarcode = (code: string): Promise<Food> =>
  apiClient.request<Food>('GET', `/api/food/barcode/${encodeURIComponent(code)}`);

export type FoodPage = { content: Food[]; page: number; size: number; totalElements: number; totalPages: number };

/** The backend needs a 2..100 character `q` and allows 30 searches a minute. */
export const getFoodPage = (q: string, page = 0, size = 20): Promise<FoodPage> =>
  apiClient.request<FoodPage>('GET', `/api/food/search?${new URLSearchParams({ q, page: String(page), size: String(size) })}`);

export const SERVING_UNITS = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving'] as const;
export type ServingUnit = (typeof SERVING_UNITS)[number];

/** Body for create and update. PUT replaces the whole food, so send every field. No barcode or createdBy. */
export type CustomFoodBody = {
  name: string;
  brand?: string | null;
  servingSize: number;
  servingUnit: ServingUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

export const createCustomFood = (body: CustomFoodBody): Promise<Food> =>
  apiClient.request<Food>('POST', '/api/food/custom', { body });

/** Own foods, newest first. The backend allows size 1..50 and has no search term. */
export const getCustomFoodPage = (page = 0, size = 20): Promise<FoodPage> =>
  apiClient.request<FoodPage>('GET', `/api/food/custom?${new URLSearchParams({ page: String(page), size: String(size) })}`);

/** Full replace. Not owner and unknown id both give 404. */
export const updateCustomFood = (id: string, body: CustomFoodBody): Promise<Food> =>
  apiClient.request<Food>('PUT', `/api/food/custom/${encodeURIComponent(id)}`, { body });

/** Soft delete, 204 with no body. */
export const deleteCustomFood = (id: string): Promise<null> =>
  apiClient.request<null>('DELETE', `/api/food/custom/${encodeURIComponent(id)}`);
