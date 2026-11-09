import { apiClient } from './client';

export type FoodSource = 'USDA' | 'OFF' | 'USER';
export type DashboardEntry = {
  id: string;
  foodName: string;
  source: FoodSource;
  mealLabel: string | null; // breakfast | lunch | dinner | snack | null
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: string; // ISO instant, oldest first
};
export type MacroTotal = { consumed: number; goal: number; unit: 'g' };
export type Dashboard = {
  date: string; // YYYY-MM-DD
  calories: { consumed: number; goal: number; remaining: number }; // remaining < 0 when over goal
  macros: { protein: MacroTotal; carbs: MacroTotal; fat: MacroTotal };
  entries: DashboardEntry[];
  streak: { current: number; longest: number }; // as of today, not the requested date
};

/** Keys hold only the date: dashboard values are health data and must not leak into keys. */
export const trackingKeys = {
  all: ['tracking'] as const,
  dashboard: (date?: string) => ['tracking', 'dashboard', date ?? 'today'] as const,
};

/** Omit `date` for today; the server resolves it in the user's timezone. */
export const getDashboard = (date?: string): Promise<Dashboard> =>
  apiClient.request<Dashboard>('GET', '/api/tracking/dashboard' + (date ? '?date=' + date : ''));

export type MealLabel = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type CreateEntryBody = {
  foodId: string;
  servingSize: number;
  servingUnit: string; // must equal the food's own unit
  quantity: number;
  mealLabel?: MealLabel;
};
export type CreatedEntry = DashboardEntry & { foodId: string; servingSize: number; servingUnit: string; quantity: number };

/** `loggedAt` is omitted so the server uses now. */
export const createEntry = (body: CreateEntryBody): Promise<CreatedEntry> =>
  apiClient.request<CreatedEntry>('POST', '/api/tracking/entries', { body });

/** Soft delete, 204 with no body. */
export const deleteEntry = (id: string): Promise<null> =>
  apiClient.request<null>('DELETE', `/api/tracking/entries/${encodeURIComponent(id)}`);
