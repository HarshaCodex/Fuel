import { SERVING_UNITS, type CustomFoodBody, type Food, type ServingUnit } from '@/api/food';

export type CustomFoodField =
  | 'name' | 'brand' | 'servingSize' | 'servingUnit' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';

/** Screen order, used for Next/Done focus and for matching API field errors. */
export const FIELDS: readonly CustomFoodField[] = [
  'name', 'brand', 'servingSize', 'servingUnit', 'calories', 'protein', 'carbs', 'fat', 'fiber',
];

export const UNITS: readonly ServingUnit[] = SERVING_UNITS;

export type FormValues = Record<CustomFoodField, string>;

export const EMPTY_FORM: FormValues = {
  name: '', brand: '', servingSize: '', servingUnit: 'g', calories: '', protein: '', carbs: '', fat: '', fiber: '',
};

export const MESSAGES = {
  name: 'Enter a name',
  number: 'Enter a number, 0 or more',
  amount: 'Enter an amount above 0',
} as const;

const MAX_NAME = 200;
const MAX_BRAND = 200;
/** Backend digit limits (integer, decimal): servingSize and calories 6+1, macros and fiber 5+2. */
const DIGITS = { servingSize: [6, 1], calories: [6, 1], protein: [5, 2], carbs: [5, 2], fat: [5, 2], fiber: [5, 2] } as const;
type NumericField = keyof typeof DIGITS;
const NUMERIC: readonly NumericField[] = ['servingSize', 'calories', 'protein', 'carbs', 'fat', 'fiber'];

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
const HINT_TOLERANCE = 0.2;

/** Digits only, optional single dot, no sign, exponent or comma. Null when malformed or beyond the backend's digits. */
function parseNumeric(text: string, field: NumericField): number | null {
  const t = text.trim();
  const [int, dec] = DIGITS[field];
  if (!new RegExp(`^(\\d{1,${int}}(\\.\\d{0,${dec}})?|\\.\\d{1,${dec}})$`).test(t)) return null;
  return Number(t);
}

/** The message for one field, or null when it is fine. Fiber may be blank. */
export function fieldError(field: CustomFoodField, values: FormValues): string | null {
  if (field === 'name') return values.name.trim() && values.name.trim().length <= MAX_NAME ? null : MESSAGES.name;
  if (field === 'brand') return values.brand.trim().length <= MAX_BRAND ? null : 'Brand must be 200 characters or fewer';
  if (field === 'servingUnit') return UNITS.includes(values.servingUnit as ServingUnit) ? null : 'Choose a unit';
  if (field === 'fiber' && !values.fiber.trim()) return null;
  const n = parseNumeric(values[field], field);
  if (field === 'servingSize') return n !== null && n > 0 ? null : MESSAGES.amount;
  return n === null ? MESSAGES.number : null;
}

export function toBody(values: FormValues): CustomFoodBody {
  const num = (f: NumericField) => parseNumeric(values[f], f) as number;
  const body: CustomFoodBody = {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    servingSize: num('servingSize'),
    servingUnit: values.servingUnit as ServingUnit,
    calories: num('calories'),
    protein: num('protein'),
    carbs: num('carbs'),
    fat: num('fat'),
  };
  if (values.fiber.trim()) body.fiber = num('fiber');
  return body;
}

/** Every field's error, and the body to send when there are none. */
export function validateForm(values: FormValues): { errors: Partial<Record<CustomFoodField, string>>; body?: CustomFoodBody } {
  const errors: Partial<Record<CustomFoodField, string>> = {};
  for (const f of FIELDS) {
    const e = fieldError(f, values);
    if (e) errors[f] = e;
  }
  return Object.keys(errors).length > 0 ? { errors } : { errors, body: toBody(values) };
}

const text = (n: number) => String(n);

/** Prefills the form from a saved food. */
export const fromFood = (food: Food): FormValues => ({
  name: food.name,
  brand: food.brand ?? '',
  servingSize: text(food.servingSize),
  servingUnit: food.servingUnit,
  calories: text(food.calories),
  protein: text(food.protein),
  carbs: text(food.carbs),
  fat: text(food.fat),
  fiber: food.fiber === undefined || food.fiber === null ? '' : text(food.fiber),
});

/** "Macros add up to about N kcal" when they differ from the calories by more than 20%; otherwise null. */
export function macroHint(values: FormValues): string | null {
  const read = (f: NumericField) => (values[f].trim() ? parseNumeric(values[f], f) : null);
  const [kcal, p, c, f] = [read('calories'), read('protein'), read('carbs'), read('fat')];
  if (kcal === null || p === null || c === null || f === null) return null;
  const total = KCAL_PER_G.protein * p + KCAL_PER_G.carbs * c + KCAL_PER_G.fat * f;
  const off = kcal === 0 ? total > 0 : Math.abs(total - kcal) / kcal > HINT_TOLERANCE;
  return off ? `Macros add up to about ${Math.round(total)} kcal` : null;
}

/** True when any field differs from the starting values (text is compared trimmed). */
export const isDirty = (values: FormValues, initial: FormValues = EMPTY_FORM): boolean =>
  FIELDS.some((f) => values[f].trim() !== initial[f].trim());
