// Mocked API responses for screenshots: request pathname -> JSON body (envelope {status,message,data}).
const ok = (data) => ({ status: 'SUCCESS', message: 'OK', data });
const macro = (consumed, goal) => ({ consumed, goal, unit: 'g' });
const at = (h, m) => new Date(Date.UTC(2026, 10, 9, h, m)).toISOString();

export const fixtures = {
  '/api/auth/login': ok({
    accessToken: 'shot-access',
    refreshToken: 'shot-refresh',
    accessTokenExpiresIn: 900,
    refreshTokenExpiresIn: 604800,
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'shots@example.com',
    name: 'Shots',
    emailVerified: true,
  }),
  '/api/user/body-stats': ok({
    height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 30, gender: 'MALE', activityLevel: 'MODERATE', updatedAt: at(0, 0),
  }),
  '/api/user/goals': ok({
    calorieGoal: 2200, proteinGoal: 165, carbGoal: 250, fatGoal: 70, isAutoCalculated: false, updatedAt: at(0, 0),
  }),
  '/api/tracking/dashboard': ok({
    date: '2026-11-09',
    calories: { consumed: 1450, goal: 2200, remaining: 750 },
    macros: { protein: macro(120, 165), carbs: macro(150, 250), fat: macro(40, 70) },
    entries: [
      { id: 'e1', foodName: 'Greek yogurt', source: 'USDA', mealLabel: 'breakfast', calories: 150, protein: 15, carbs: 8, fat: 4, loggedAt: at(8, 0) },
      { id: 'e2', foodName: 'Chicken salad', source: 'OFF', mealLabel: 'lunch', calories: 520, protein: 46, carbs: 12, fat: 5, loggedAt: at(12, 30) },
      { id: 'e3', foodName: 'Protein bar', source: 'USER', mealLabel: 'snack', calories: 230, protein: 20, carbs: 22, fat: 7, loggedAt: at(15, 45) },
    ],
    streak: { current: 5, longest: 9 },
  }),
  '/api/tracking/entries': ok([
    { id: 'e1', foodId: 'f2', foodName: 'Greek yogurt', source: 'USDA', mealLabel: 'breakfast', calories: 150, protein: 15, carbs: 8, fat: 4, loggedAt: at(8, 0), servingSize: 170, servingUnit: 'g', quantity: 1 },
    { id: 'e2', foodId: 'f4', foodName: 'Chicken salad', source: 'OFF', mealLabel: 'lunch', calories: 520, protein: 46, carbs: 12, fat: 5, loggedAt: at(12, 30), servingSize: 250, servingUnit: 'g', quantity: 1 },
    { id: 'e3', foodId: 'c2', foodName: 'Protein bar', source: 'USER', mealLabel: 'snack', calories: 230, protein: 20, carbs: 22, fat: 7, loggedAt: at(15, 45), servingSize: 60, servingUnit: 'g', quantity: 1 },
  ]),
  '/api/food/recent': ok([
    { id: 'f1', name: 'Chicken breast', brand: null, source: 'USDA', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, lastLoggedAt: at(12, 30) },
    { id: 'f2', name: 'Greek yogurt', brand: 'Fage', source: 'OFF', servingSize: 170, servingUnit: 'g', calories: 100, protein: 18, carbs: 6, fat: 0, lastLoggedAt: at(8, 0) },
  ]),
  '/api/food/search': ok({
    content: [
      { id: 'f1', name: 'Chicken breast', brand: null, source: 'USDA', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      { id: 'f3', name: 'Chicken thigh', brand: 'Fresh Farm', source: 'OFF', servingSize: 100, servingUnit: 'g', calories: 209, protein: 26, carbs: 0, fat: 11 },
    ],
    page: 0, size: 20, totalElements: 2, totalPages: 1,
  }),
  '/api/food/custom': ok({
    content: [
      { id: 'c1', name: 'Overnight oats', brand: 'Homemade', source: 'USER', servingSize: 250, servingUnit: 'g', calories: 320, protein: 14, carbs: 48, fat: 8 },
      { id: 'c2', name: 'Protein bar', brand: null, source: 'USER', servingSize: 60, servingUnit: 'g', calories: 230, protein: 20, carbs: 22, fat: 7 },
    ],
    page: 0, size: 20, totalElements: 2, totalPages: 1,
  }),
};

// The editor refetches the food it was seeded with.
fixtures['/api/food/c1'] = ok(fixtures['/api/food/custom'].data.content[0]);

/** Same endpoint with no foods, for the My Foods empty state. */
export const emptyCustomFoods = ok({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
