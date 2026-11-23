import type { GoalsInput } from '@/api/user';

import { parseNumber } from './bodyStatsForm';

export type GoalsForm = { calories: string; protein: string; carbs: string; fat: string };
export type GoalsField = 'calorieGoal' | 'proteinGoal' | 'carbGoal' | 'fatGoal';

export const GOALS_FIELDS: readonly GoalsField[] = ['calorieGoal', 'proteinGoal', 'carbGoal', 'fatGoal'];

export const GOALS_MESSAGES = {
  caloriesRequired: 'Enter your calorie goal',
  caloriesRange: 'Calories must be a whole number from 800 to 10000',
  macroRequired: 'Enter a number from 0 to 9999.9',
  macroRange: 'Enter a number from 0 to 9999.9',
  unmatched: 'Some details were not accepted. Check your answers and try again.',
  offline: "You're offline. Check your connection and try again.",
  generic: "Couldn't save your goals. Try again.",
  loadFailed: "Couldn't load your goals.",
} as const;

const MIN_CALORIES = 800;
const MAX_CALORIES = 10000;
const MAX_MACRO = 9999.9;
const DISPLAY_DECIMALS = 10; // one decimal place
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
const PERCENT = 100;

const round1 = (n: number) => Math.round(n * DISPLAY_DECIMALS) / DISPLAY_DECIMALS;
const show = (n: number) => String(round1(n));

export const formFromGoals = (g: GoalsInput): GoalsForm => ({
  calories: String(Math.round(g.calorieGoal)),
  protein: show(g.proteinGoal),
  carbs: show(g.carbGoal),
  fat: show(g.fatGoal),
});

function readMacro(text: string): { value?: number; error?: string } {
  const m = GOALS_MESSAGES;
  if (!text.trim()) return { error: m.macroRequired };
  const n = parseNumber(text);
  if (n === null) return { error: m.macroRange };
  const v = round1(n);
  return v > MAX_MACRO ? { error: m.macroRange } : { value: v };
}

export function validateGoals(f: GoalsForm): { errors: Partial<Record<GoalsField, string>>; input?: GoalsInput } {
  const m = GOALS_MESSAGES;
  const errors: Partial<Record<GoalsField, string>> = {};
  let calories: number | undefined;
  if (!f.calories.trim()) errors.calorieGoal = m.caloriesRequired;
  else {
    const n = parseNumber(f.calories);
    if (n === null || !Number.isInteger(n) || n < MIN_CALORIES || n > MAX_CALORIES) errors.calorieGoal = m.caloriesRange;
    else calories = n;
  }
  const protein = readMacro(f.protein);
  const carbs = readMacro(f.carbs);
  const fat = readMacro(f.fat);
  if (protein.error) errors.proteinGoal = protein.error;
  if (carbs.error) errors.carbGoal = carbs.error;
  if (fat.error) errors.fatGoal = fat.error;
  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    input: { calorieGoal: calories!, proteinGoal: protein.value!, carbGoal: carbs.value!, fatGoal: fat.value! },
  };
}

/** Share of the calorie goal that the macros add up to, or null until every field is valid. */
export function macroCheck(f: GoalsForm): { percent: number } | null {
  const { input } = validateGoals(f);
  if (!input) return null;
  const kcal = KCAL_PER_G.protein * input.proteinGoal + KCAL_PER_G.carbs * input.carbGoal + KCAL_PER_G.fat * input.fatGoal;
  return { percent: Math.round((kcal / input.calorieGoal) * PERCENT) };
}

export const summarizeGoals = (g: GoalsInput): string =>
  `Protein ${show(g.proteinGoal)} g, Carbs ${show(g.carbGoal)} g, Fat ${show(g.fatGoal)} g`;
