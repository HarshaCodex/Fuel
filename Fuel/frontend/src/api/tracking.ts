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
