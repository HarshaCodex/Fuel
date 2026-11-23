import { mealForHour } from './mealLabel';

it.each([[0, 'breakfast'], [10, 'breakfast'], [11, 'lunch'], [14, 'lunch'], [15, 'snack'], [16, 'snack'], [17, 'dinner'], [23, 'dinner']])('hour %i -> %s', (h, label) => {
  expect(mealForHour(h)).toBe(label);
});
