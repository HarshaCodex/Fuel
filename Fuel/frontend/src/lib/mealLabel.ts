import type { MealLabel } from '@/api/tracking';

export const MEAL_OPTIONS: readonly { value: MealLabel; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

/** Default meal by device local hour: before 11 breakfast, 11 to 14 lunch, 15 to 16 snack, else dinner. */
export function mealForHour(hour: number): MealLabel {
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}
