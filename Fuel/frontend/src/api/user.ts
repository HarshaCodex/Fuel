import { apiClient } from './client';

export type HeightUnit = 'cm' | 'ft'; // ft = decimal feet
export type WeightUnit = 'kg' | 'lbs';
export type Gender = 'MALE' | 'FEMALE';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type GoalType = 'LOSE' | 'MAINTAIN' | 'GAIN';

export type BodyStatsInput = {
  height: number;
  heightUnit: HeightUnit;
  weight: number;
  weightUnit: WeightUnit;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
};
/** Responses are always cm/kg. */
export type BodyStats = BodyStatsInput & { updatedAt: string };

export type GoalsInput = { calorieGoal: number; proteinGoal: number; carbGoal: number; fatGoal: number };
export type Goals = GoalsInput & { isAutoCalculated: boolean; updatedAt: string | null };

/** Server defaults: MAINTAIN and a 500 kcal deficit; the deficit is ignored for MAINTAIN. */
export type RecalculateInput = { goal?: GoalType; deficit?: number };
export type RecalculatedGoals = Omit<Goals, 'updatedAt'> & {
  tdee: number;
  deficit: number;
  formula: string;
  macroSplit: string;
};

/** Health data: keep it out of keys beyond these constants. */
export const userKeys = { bodyStats: ['user', 'bodyStats'] as const, goals: ['user', 'goals'] as const };

/** Resolves null when the user has not saved body stats yet. */
export const getBodyStats = async () =>
  (await apiClient.request<BodyStats | null>('GET', '/api/user/body-stats')) ?? null;

export const putBodyStats = (input: BodyStatsInput) =>
  apiClient.request<BodyStats>('PUT', '/api/user/body-stats', { body: input });

export const getGoals = () => apiClient.request<Goals>('GET', '/api/user/goals');

export const putGoals = (input: GoalsInput) => apiClient.request<Goals>('PUT', '/api/user/goals', { body: input });

/** Sends no body when `input` is omitted so the server applies its defaults. */
export const recalculateGoals = (input?: RecalculateInput) =>
  apiClient.request<RecalculatedGoals>('POST', '/api/user/goals/recalculate', input ? { body: input } : {});
