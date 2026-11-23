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
  entries: (date?: string) => ['tracking', 'entries', date ?? 'today'] as const,
  history: (from: string, to: string) => ['tracking', 'history', from, to] as const,
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

/** Every field is optional and only sent when changed. The food itself cannot change. */
export type UpdateEntryBody = { servingSize?: number; quantity?: number; mealLabel?: MealLabel };

/** Returns the entry with nutrients recomputed from its original food. */
export const updateEntry = (id: string, body: UpdateEntryBody): Promise<CreatedEntry> =>
  apiClient.request<CreatedEntry>('PUT', `/api/tracking/entries/${encodeURIComponent(id)}`, { body });

/** Full entries for a day (with amount and quantity, which the dashboard payload lacks). Omit `date` for today. */
export const getEntries = (date?: string): Promise<CreatedEntry[]> =>
  apiClient.request<CreatedEntry[]>('GET', '/api/tracking/entries' + (date ? '?date=' + date : ''));

/** One logged day. `calorieGoal` is the current goal and is the same on every row. */
export type HistoryDay = {
  date: string; // YYYY-MM-DD
  calories: number;
  calorieGoal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  entryCount: number;
};

/** Both dates inclusive, at most 90 days apart. Newest first; days with no entries are omitted. */
export const getHistory = (from: string, to: string): Promise<HistoryDay[]> =>
  apiClient.request<HistoryDay[]>('GET', `/api/tracking/history?from=${from}&to=${to}`);
