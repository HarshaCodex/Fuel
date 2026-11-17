import type { BodyStats, Goals } from '@/api/user';

import {
  activityShort,
  bodyStatColumns,
  bodyStatsA11y,
  customFoodsValue,
  goalA11y,
  goalSource,
  GOAL_SOURCE_LABEL,
  macroShare,
  macroTiles,
} from './profileView';

const goals: Goals = { calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70, isAutoCalculated: true, updatedAt: '2026-11-01T00:00:00Z' };
const body: BodyStats = { height: 178, heightUnit: 'cm', weight: 80.04, weightUnit: 'kg', age: 32, gender: 'MALE', activityLevel: 'MODERATE', updatedAt: '2026-11-01T00:00:00Z' };

describe('goalSource', () => {
  it('is default when never saved, even if auto', () => {
    expect(goalSource({ ...goals, updatedAt: null })).toBe('default');
    expect(goalSource({ ...goals, updatedAt: null, isAutoCalculated: false })).toBe('default');
    expect(GOAL_SOURCE_LABEL.default).toBe('Default targets');
  });
  it('is bodyStats when auto-calculated and saved', () => {
    expect(goalSource(goals)).toBe('bodyStats');
    expect(GOAL_SOURCE_LABEL.bodyStats).toBe('From body stats');
  });
  it('is manual otherwise', () => {
    expect(goalSource({ ...goals, isAutoCalculated: false })).toBe('manual');
    expect(GOAL_SOURCE_LABEL.manual).toBe('Set by you');
  });
});

describe('macroShare', () => {
  it('rounds 150 g protein of 2200 kcal to 27', () => {
    expect(macroShare(150, 'protein', 2200)).toBe(27);
  });
  it('uses 4 for carbs and 9 for fat', () => {
    expect(macroShare(250, 'carbs', 2200)).toBe(45);
    expect(macroShare(70, 'fat', 2200)).toBe(29);
  });
  it('rounds at the half boundary up', () => {
    expect(macroShare(1, 'fat', 200)).toBe(5);
    expect(macroShare(1, 'protein', 800)).toBe(1);
  });
  it('is null for a zero or negative goal and never divides by zero', () => {
    expect(macroShare(150, 'protein', 0)).toBeNull();
    expect(macroShare(150, 'protein', -5)).toBeNull();
  });
  it('is 0 for zero grams', () => {
    expect(macroShare(0, 'fat', 2000)).toBe(0);
  });
});

describe('macroTiles', () => {
  it('orders protein, carbs, fat with shares', () => {
    expect(macroTiles(goals)).toEqual([
      { key: 'protein', label: 'Protein', grams: 150, share: 27 },
      { key: 'carbs', label: 'Carbs', grams: 250, share: 45 },
      { key: 'fat', label: 'Fat', grams: 70, share: 29 },
    ]);
  });
  it('has null shares when the calorie goal is 0', () => {
    expect(macroTiles({ ...goals, calorieGoal: 0 }).map((t) => t.share)).toEqual([null, null, null]);
  });
});

describe('body stats', () => {
  it('maps activity levels to short labels', () => {
    expect(activityShort('SEDENTARY')).toBe('Sedentary');
    expect(activityShort('VERY_ACTIVE')).toBe('Very active');
  });
  it('builds four columns with one-decimal rounding', () => {
    expect(bodyStatColumns(body)).toEqual([
      { label: 'Height', value: '178 cm' },
      { label: 'Weight', value: '80 kg' },
      { label: 'Age', value: '32' },
      { label: 'Activity', value: 'Moderate' },
    ]);
    expect(bodyStatColumns({ ...body, height: 177.54, weight: 79.46 }).slice(0, 2).map((c) => c.value)).toEqual(['177.5 cm', '79.5 kg']);
  });
  it('reads all four values and the action', () => {
    expect(bodyStatsA11y(body)).toBe('Height 178 cm, Weight 80 kg, Age 32, Activity Moderate. Edit body stats');
  });
});

describe('goalA11y', () => {
  it('reads goal, source and each macro with percent', () => {
    expect(goalA11y(goals)).toBe(
      'Daily goal 2,200 calories, from body stats. Protein 150 grams, 27 percent of calories. Carbs 250 grams, 45 percent of calories. Fat 70 grams, 29 percent of calories',
    );
  });
  it('drops the percent clause when there is no share', () => {
    expect(goalA11y({ ...goals, calorieGoal: 0 })).not.toContain('percent');
  });
});

describe('customFoodsValue', () => {
  it('is undefined while unknown and a string for 0 and 5', () => {
    expect(customFoodsValue(undefined)).toBeUndefined();
    expect(customFoodsValue(0)).toBe('0');
    expect(customFoodsValue(5)).toBe('5');
    expect(customFoodsValue(1200)).toBe('1,200');
  });
});
