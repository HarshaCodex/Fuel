import type { Food } from '@/api/food';

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

/** Backend limits: servingSize has 6 integer and 1 decimal digit, quantity 3 and 2. */
export const MAX_QUANTITY = 999.5;
const AMOUNT_PATTERN = /^\d{1,6}(\.\d)?$/;

/** Parses the amount field; null when it is empty, not a number, not above zero or beyond the backend's digits. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!AMOUNT_PATTERN.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

export function amountError(text: string): string | null {
  return parseAmount(text) === null ? 'Enter an amount above 0, with at most one decimal' : null;
}

/** Macros for `amount` (in the food's own unit) times `quantity`, scaled from the food's serving. */
export function portionMacros(food: Food, amount: number, quantity: number): Macros {
  const factor = (amount * quantity) / food.servingSize;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
  };
}

