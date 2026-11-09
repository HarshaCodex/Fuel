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
};
