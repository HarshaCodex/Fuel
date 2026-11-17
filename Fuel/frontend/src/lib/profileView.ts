import type { ActivityLevel, BodyStats, Goals } from '@/api/user';

import { formatGrams, formatKcal } from './dashboardView';

export type GoalSource = 'default' | 'bodyStats' | 'manual';

export const GOAL_SOURCE_LABEL: Record<GoalSource, string> = {
  default: 'Default targets',
  bodyStats: 'From body stats',
  manual: 'Set by you',
};

/** Never saved -> default; else auto-calculated -> body stats; else the user's own numbers. */
export function goalSource(g: Goals): GoalSource {
  if (g.updatedAt === null) return 'default';
  return g.isAutoCalculated ? 'bodyStats' : 'manual';
}

export type MacroKind = 'protein' | 'carbs' | 'fat';
const KCAL_PER_GRAM: Record<MacroKind, number> = { protein: 4, carbs: 4, fat: 9 };

/** Whole percent of the calorie goal; null when there is no goal to divide by. */
export function macroShare(grams: number, kind: MacroKind, calorieGoal: number): number | null {
  if (!(calorieGoal > 0)) return null;
  return Math.round((grams * KCAL_PER_GRAM[kind] * 100) / calorieGoal);
}

export type MacroTile = { key: MacroKind; label: 'Protein' | 'Carbs' | 'Fat'; grams: number; share: number | null };

export function macroTiles(g: Goals): MacroTile[] {
  const tile = (key: MacroKind, label: MacroTile['label'], grams: number): MacroTile => ({
    key,
    label,
    grams,
    share: macroShare(grams, key, g.calorieGoal),
  });
  return [tile('protein', 'Protein', g.proteinGoal), tile('carbs', 'Carbs', g.carbGoal), tile('fat', 'Fat', g.fatGoal)];
}

export const ACTIVITY_SHORT: Record<ActivityLevel, string> = {
  SEDENTARY: 'Sedentary',
  LIGHT: 'Light',
  MODERATE: 'Moderate',
  ACTIVE: 'Active',
  VERY_ACTIVE: 'Very active',
};
export const activityShort = (level: ActivityLevel): string => ACTIVITY_SHORT[level];

export type BodyStatColumn = { label: 'Height' | 'Weight' | 'Age' | 'Activity'; value: string };

/** Responses are always cm and kg. */
export function bodyStatColumns(b: BodyStats): BodyStatColumn[] {
  return [
    { label: 'Height', value: `${formatGrams(b.height)} cm` },
    { label: 'Weight', value: `${formatGrams(b.weight)} kg` },
    { label: 'Age', value: String(b.age) },
    { label: 'Activity', value: activityShort(b.activityLevel) },
  ];
}

export function goalA11y(g: Goals): string {
  const source = GOAL_SOURCE_LABEL[goalSource(g)].toLowerCase();
  const macros = macroTiles(g)
    .map((t) => `${t.label} ${formatGrams(t.grams)} grams${t.share === null ? '' : `, ${t.share} percent of calories`}`)
    .join('. ');
  return `Daily goal ${formatKcal(g.calorieGoal)} calories, ${source}. ${macros}`;
}

export function bodyStatsA11y(b: BodyStats): string {
  const parts = bodyStatColumns(b).map((c) => `${c.label} ${c.value}`);
  return `${parts.join(', ')}. Edit body stats`;
}

/** The My Foods row value; nothing while the count is unknown. */
export const customFoodsValue = (count?: number): string | undefined =>
  count === undefined ? undefined : count.toLocaleString('en-US');
