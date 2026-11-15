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


export type PortionKey = 'half' | 'one' | 'oneHalf';
export type PortionTile = { key: PortionKey; amount: number; amountLabel: string; caption: string };

const TILES: readonly { key: PortionKey; factor: number; caption: string }[] = [
  { key: 'half', factor: 0.5, caption: '½ serving' },
  { key: 'one', factor: 1, caption: '1 serving' },
  { key: 'oneHalf', factor: 1.5, caption: '1½ servings' },
];
const PLAIN_UNITS = new Set(['g', 'ml']);

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** "50 g", "12.5 g", "½ cup", "1½ piece", "2.3 slice": g and ml are plain decimals, other units use halves when exact. */
export function formatPortionAmount(n: number, unit: string): string {
  const r = round1(n);
  if (!PLAIN_UNITS.has(unit) && Number.isInteger(r * 2)) {
    const whole = Math.floor(r);
    const half = r % 1 !== 0;
    const text = whole === 0 ? '½' : `${whole}${half ? '½' : ''}`;
    return `${text} ${unit}`;
  }
  return `${r} ${unit}`;
}

/** The three preset portions: half, one and one and a half servings, rounded to the backend's single decimal. */
export function portionTiles(food: Food): PortionTile[] {
  return TILES.map(({ key, factor, caption }) => {
    const amount = Math.max(0.1, round1(food.servingSize * factor));
    return { key, amount, amountLabel: formatPortionAmount(amount, food.servingUnit), caption };
  });
}

/** Flex weights for the calorie split bar: kcal from protein and carbs (4/g) and fat (9/g); 0 when a nutrient is 0. */
export function calorieSplit(m: Macros): { protein: number; carbs: number; fat: number } {
  const w = (g: number, k: number) => (g > 0 ? g * k : 0);
  return { protein: w(m.protein, 4), carbs: w(m.carbs, 4), fat: w(m.fat, 9) };
}
