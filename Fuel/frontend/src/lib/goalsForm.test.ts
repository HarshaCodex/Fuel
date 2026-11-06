import { formFromGoals, GOALS_MESSAGES, macroCheck, summarizeGoals, validateGoals, type GoalsForm } from './goalsForm';

const ok: GoalsForm = { calories: '2200', protein: '150', carbs: '250', fat: '70' };
const withF = (p: Partial<GoalsForm>): GoalsForm => ({ ...ok, ...p });

describe('formFromGoals / summarizeGoals', () => {
  it('uses one decimal and drops a trailing .0', () => {
    const g = { calorieGoal: 2200, proteinGoal: 150.04, carbGoal: 250.25, fatGoal: 70 };
    expect(formFromGoals(g)).toEqual({ calories: '2200', protein: '150', carbs: '250.3', fat: '70' });
    expect(summarizeGoals(g)).toBe('Protein 150 g, Carbs 250.3 g, Fat 70 g');
  });
});

describe('validateGoals', () => {
  it('accepts valid values and a decimal comma', () => {
    expect(validateGoals(withF({ protein: '12,5' })).input).toEqual({
      calorieGoal: 2200, proteinGoal: 12.5, carbGoal: 250, fatGoal: 70,
    });
  });

  it.each(['', 'abc', '1e3', '-5', '1.2.3'])('rejects macro %p', (v) => {
    expect(validateGoals(withF({ fat: v })).errors.fatGoal).toBe(GOALS_MESSAGES.macroRange);
  });

  it.each(['799', '10001', '2000.5', 'abc'])('rejects calories %p', (v) => {
    expect(validateGoals(withF({ calories: v })).errors.calorieGoal).toBe(GOALS_MESSAGES.caloriesRange);
  });

  it('requires calories', () => {
    expect(validateGoals(withF({ calories: ' ' })).errors.calorieGoal).toBe(GOALS_MESSAGES.caloriesRequired);
  });

  it.each(['800', '10000'])('accepts calories %p', (v) => {
    expect(validateGoals(withF({ calories: v })).input?.calorieGoal).toBe(Number(v));
  });

  it('accepts macro 0 and 9999.9, rejects 10000 and values rounding above the max', () => {
    expect(validateGoals(withF({ carbs: '0', protein: '9999.9' })).errors).toEqual({});
    expect(validateGoals(withF({ carbs: '10000' })).errors.carbGoal).toBeDefined();
    expect(validateGoals(withF({ carbs: '9999.95' })).errors.carbGoal).toBeDefined();
  });

  it('rounds macros to one decimal', () => {
    expect(validateGoals(withF({ protein: '10.04' })).input?.proteinGoal).toBe(10);
  });
});

describe('macroCheck', () => {
  it('is 100 for a 40/40/20 split', () => {
    expect(macroCheck({ calories: '2000', protein: '200', carbs: '200', fat: '44.4' })).toEqual({ percent: 100 });
  });
  it('reports a shortfall', () => {
    expect(macroCheck({ calories: '2000', protein: '150', carbs: '200', fat: '40' })?.percent).toBe(88);
  });
  it('is null when any field is invalid, including zero calories', () => {
    expect(macroCheck(withF({ calories: '' }))).toBeNull();
    expect(macroCheck(withF({ calories: '0' }))).toBeNull();
    expect(macroCheck(withF({ fat: 'x' }))).toBeNull();
  });
});
