import type { Food } from '@/api/food';
import { amountError, calorieSplit, formatPortionAmount, parseAmount, portionMacros, portionTiles } from './portion';

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

describe('portionTiles', () => {
  const mk = (servingSize: number, servingUnit: string): Food => ({ ...food, servingSize, servingUnit });
  const labels = (f: Food) => portionTiles(f).map((t) => t.amountLabel);

  it('uses plain decimals for grams', () => {
    expect(labels(mk(100, 'g'))).toEqual(['50 g', '100 g', '150 g']);
    expect(labels(mk(25, 'g'))).toEqual(['12.5 g', '25 g', '37.5 g']);
    expect(labels(mk(15, 'g'))[0]).toBe('7.5 g');
  });
  it('uses halves for other units', () => {
    expect(labels(mk(1, 'cup'))).toEqual(['½ cup', '1 cup', '1½ cup']);
    expect(labels(mk(2, 'piece'))).toEqual(['1 piece', '2 piece', '3 piece']);
  });
  it('falls back to one decimal when not a half step', () => {
    expect(labels(mk(1.3, 'slice'))).toEqual(['0.7 slice', '1.3 slice', '2 slice']);
  });
  it('rounds to one decimal and keeps the amount sent', () => {
    const t = portionTiles(mk(2.5, 'g'));
    expect(t[0].amount).toBe(1.3);
    expect(t[1].amount).toBe(2.5);
  });
  it('never goes below 0.1', () => {
    expect(portionTiles(mk(0.1, 'g'))[0].amount).toBe(0.1);
  });
  it('captions the tiles', () => {
    expect(portionTiles(food).map((t) => t.caption)).toEqual(['½ serving', '1 serving', '1½ servings']);
  });
});

describe('formatPortionAmount', () => {
  it('does not show zero as a half', () => {
    expect(formatPortionAmount(0, 'cup')).toBe('0 cup');
  });
});

describe('calorieSplit', () => {
  it('weights protein and carbs by 4 and fat by 9', () => {
    expect(calorieSplit({ calories: 0, protein: 10, carbs: 5, fat: 2 })).toEqual({ protein: 40, carbs: 20, fat: 18 });
  });
  it('is zero for a missing nutrient and for an all-zero food', () => {
    expect(calorieSplit({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }).carbs).toBe(0);
    expect(calorieSplit({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
