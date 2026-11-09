import type { Food } from '@/api/food';
import { amountError, parseAmount, portionMacros } from './portion';

const food: Food = { id: 'f', name: 'Chicken', brand: null, source: 'USDA', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6 };

describe('portionMacros', () => {
  it('scales by amount and quantity', () => {
    const m = portionMacros(food, 150, 1);
    expect(Math.round(m.calories)).toBe(248);
    expect(m.protein).toBeCloseTo(46.5);
    expect(portionMacros(food, 100, 2).calories).toBe(330);
  });
});

describe('parseAmount', () => {
  it.each([['', null], ['0', null], ['abc', null], ['1.55', null], ['-1', null], ['1234567', null], ['150', 150], ['0.5', 0.5], [' 12.5 ', 12.5]])('%j -> %j', (t, out) => {
    expect(parseAmount(t)).toBe(out);
  });
  it('has an error message only when invalid', () => {
    expect(amountError('0')).toMatch(/above 0/);
    expect(amountError('10')).toBeNull();
  });
});
