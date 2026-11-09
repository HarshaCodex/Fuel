import type { Food } from '@/api/food';

import {
  EMPTY_FORM, FIELDS, fieldError, fromFood, isDirty, macroHint, MESSAGES, toBody, UNITS, validateForm, type FormValues,
} from './customFoodForm';

const ok: FormValues = {
  name: ' Oats ', brand: '', servingSize: '40', servingUnit: 'g', calories: '150', protein: '5', carbs: '27', fat: '3', fiber: '',
};
const withV = (p: Partial<FormValues>): FormValues => ({ ...ok, ...p });

describe('validateForm', () => {
  it('builds a trimmed body with brand null and no fiber', () => {
    const { errors, body } = validateForm(ok);
    expect(errors).toEqual({});
    expect(body).toEqual({ name: 'Oats', brand: null, servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3 });
    expect(body).not.toHaveProperty('fiber');
  });

  it('keeps brand and fiber when given, and accepts calories 0 and .5', () => {
    const { body } = validateForm(withV({ brand: ' Acme ', fiber: '2.25', calories: '0', servingSize: '.5' }));
    expect(body).toMatchObject({ brand: 'Acme', fiber: 2.25, calories: 0, servingSize: 0.5 });
  });

  it.each(['', '   '])('rejects blank name %p', (v) => {
    expect(validateForm(withV({ name: v })).errors.name).toBe(MESSAGES.name);
  });

  it('limits name to 200 characters', () => {
    expect(fieldError('name', withV({ name: 'a'.repeat(200) }))).toBeNull();
    expect(fieldError('name', withV({ name: 'a'.repeat(201) }))).toBe(MESSAGES.name);
  });

  it('limits brand to 200 characters', () => {
    expect(fieldError('brand', withV({ brand: 'a'.repeat(201) }))).not.toBeNull();
  });

  it.each(['', '0', '-1', '1e3', '1,5', 'abc', '1234567', '1.55', '.'])('rejects servingSize %p', (v) => {
    expect(fieldError('servingSize', withV({ servingSize: v }))).toBe(MESSAGES.amount);
  });

  it.each(['123456', '123456.7', '0.5'])('accepts servingSize %p', (v) => {
    expect(fieldError('servingSize', withV({ servingSize: v }))).toBeNull();
  });

  it.each(['', '-1', '1e3', '1,5', 'x', '1234567', '12.55'])('rejects calories %p', (v) => {
    expect(fieldError('calories', withV({ calories: v }))).toBe(MESSAGES.number);
  });

  it.each(['', '-0.1', '123456', '1.234'])('rejects protein %p', (v) => {
    expect(fieldError('protein', withV({ protein: v }))).toBe(MESSAGES.number);
  });

  it('accepts macros with two decimals and 5 integer digits', () => {
    expect(fieldError('fat', withV({ fat: '12345.25' }))).toBeNull();
  });

  it('rejects a bad fiber but not a blank one', () => {
    expect(fieldError('fiber', withV({ fiber: '-1' }))).toBe(MESSAGES.number);
    expect(fieldError('fiber', withV({ fiber: ' ' }))).toBeNull();
  });

  it('rejects an unknown unit', () => {
    expect(fieldError('servingUnit', withV({ servingUnit: 'lb' }))).toBe('Choose a unit');
  });

  it('reports every bad field and sends no body', () => {
    const r = validateForm(withV({ name: '', calories: '-5' }));
    expect(Object.keys(r.errors).sort()).toEqual(['calories', 'name']);
    expect(r.body).toBeUndefined();
  });
});

describe('constants', () => {
  it('lists eight units and every field once', () => {
    expect(UNITS).toEqual(['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving']);
    expect(FIELDS).toHaveLength(9);
    expect(Object.keys(EMPTY_FORM).sort()).toEqual([...FIELDS].sort());
  });
});

describe('fromFood', () => {
  const food: Food = {
    id: 'f1', name: 'Oats', brand: null, source: 'USER', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3.5,
  };

  it('turns numbers into text, null brand and missing fiber into empty', () => {
    expect(fromFood(food)).toEqual({
      name: 'Oats', brand: '', servingSize: '40', servingUnit: 'g', calories: '150', protein: '5', carbs: '27', fat: '3.5', fiber: '',
    });
  });

  it('round-trips through toBody', () => {
    expect(toBody(fromFood({ ...food, brand: 'Acme', fiber: 4 }))).toEqual({
      name: 'Oats', brand: 'Acme', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 3.5, fiber: 4,
    });
  });
});

describe('macroHint', () => {
  it('is null when macros roughly match the calories', () => {
    expect(macroHint(withV({ calories: '150', protein: '5', carbs: '27', fat: '3' }))).toBeNull(); // 155 kcal
  });

  it('shows the macro total when it is off by more than 20%', () => {
    expect(macroHint(withV({ calories: '300' }))).toBe('Macros add up to about 155 kcal');
  });

  it('stays quiet at exactly 20% off', () => {
    expect(macroHint(withV({ calories: '100', protein: '30', carbs: '0', fat: '0' }))).toBeNull();
  });

  it('is null while a field is blank or invalid', () => {
    expect(macroHint(withV({ fat: '' }))).toBeNull();
    expect(macroHint(withV({ calories: 'x' }))).toBeNull();
  });

  it('handles zero calories', () => {
    expect(macroHint(withV({ calories: '0', protein: '0', carbs: '0', fat: '0' }))).toBeNull();
    expect(macroHint(withV({ calories: '0' }))).toBe('Macros add up to about 155 kcal');
  });
});

describe('isDirty', () => {
  it('is false for the empty form and whitespace-only edits', () => {
    expect(isDirty(EMPTY_FORM)).toBe(false);
    expect(isDirty({ ...EMPTY_FORM, name: '  ' })).toBe(false);
  });

  it('is true after typing and compares against a given start', () => {
    expect(isDirty(withV({ name: 'x' }))).toBe(true);
    expect(isDirty(ok, ok)).toBe(false);
    expect(isDirty(withV({ fat: '4' }), ok)).toBe(true);
  });
});
