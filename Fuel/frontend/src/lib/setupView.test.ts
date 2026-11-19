import { emptyBodyStatsForm, type BodyStatsForm } from './bodyStatsForm';
import {
  DAILY_CHANGES, DEFAULT_DEFICIT, PANEL_EMPTY, allValid, customDeficitError, isPreset, panelA11y, rowError, setupRows, tileLabel,
} from './setupView';

const metric: BodyStatsForm = { ...emptyBodyStatsForm('metric'), age: '31', heightCm: '178', weight: '80', gender: 'MALE', activityLevel: 'MODERATE' };
const imperial: BodyStatsForm = { ...emptyBodyStatsForm('imperial'), age: '31', heightFt: '5', heightIn: '10', weight: '176', gender: 'FEMALE', activityLevel: 'LIGHT' };

describe('setupRows', () => {
  it('shows values and a11y for a metric form', () => {
    const rows = setupRows(metric);
    expect(rows.map((r) => r.value)).toEqual(['31', 'Male', '178 cm', '80 kg', 'Moderate']);
    expect(rows.map((r) => r.label)).toEqual(['Age', 'Sex', 'Height', 'Weight', 'Activity']);
    expect(rows[0].a11y).toBe('Age, 31');
  });

  it('shows imperial units', () => {
    const rows = setupRows(imperial);
    expect(rows[2].value).toBe('5 ft 10 in');
    expect(rows[3].value).toBe('176 lb');
  });

  it('leaves empty fields undefined and says not set', () => {
    const rows = setupRows(emptyBodyStatsForm());
    expect(rows.every((r) => r.value === undefined)).toBe(true);
    expect(rows[0].a11y).toBe('Age, not set');
  });

  it('shows a partly filled imperial height', () => {
    expect(setupRows({ ...emptyBodyStatsForm('imperial'), heightFt: '5' })[2].value).toBe('5 ft');
  });
});

describe('validation helpers', () => {
  it('reports row errors and completeness', () => {
    expect(allValid(metric)).toBe(true);
    expect(rowError(metric, 'age')).toBeUndefined();
    expect(rowError({ ...metric, age: '5' }, 'age')).toMatch(/13 to 120/);
    expect(allValid({ ...metric, gender: null })).toBe(false);
  });

  it('accepts imperial feet with empty inches and rejects bad inches or feet', () => {
    expect(rowError({ ...imperial, heightIn: '' }, 'height')).toBeUndefined();
    expect(rowError({ ...imperial, heightIn: '11.5' }, 'height')).toBeUndefined();
    expect(rowError({ ...imperial, heightIn: '11.9' }, 'height')).toBeUndefined();
    expect(rowError({ ...imperial, heightIn: '-1' }, 'height')).toBeDefined();
    expect(rowError({ ...imperial, heightIn: 'x' }, 'height')).toBeDefined();
    expect(rowError({ ...imperial, heightFt: '5.5' }, 'height')).toBeDefined();
    expect(rowError({ ...imperial, heightFt: '0', heightIn: '0' }, 'height')).toBeDefined();
    expect(rowError({ ...imperial, heightFt: '', heightIn: '' }, 'height')).toBeDefined();
    expect(rowError({ ...imperial, heightFt: '1001' }, 'height')).toBeDefined();
  });

  it('shows inches-only imperial height and ignores the other units fields', () => {
    expect(setupRows({ ...emptyBodyStatsForm('imperial'), heightIn: '7' })[2].value).toBe('7 in');
    expect(setupRows({ ...metric, heightFt: '9' })[2].value).toBe('178 cm');
    expect(allValid({ ...imperial, heightIn: '12' })).toBe(false);
  });

  it('covers imperial height in one row', () => {
    expect(rowError({ ...imperial, heightIn: '12' }, 'height')).toMatch(/Inches/);
    expect(rowError({ ...imperial, heightFt: '' }, 'height')).toBeDefined();
    expect(rowError({ ...metric, heightCm: '' }, 'height')).toBeDefined();
  });
});

describe('daily change', () => {
  it('has presets and a default', () => {
    expect(DAILY_CHANGES.map((c) => c.value)).toEqual([250, 500, 750]);
    expect(DEFAULT_DEFICIT).toBe(500);
    expect(isPreset(500)).toBe(true);
    expect(isPreset(600)).toBe(false);
  });

  it.each(['100', '1000', '350', ' 500 '])('accepts %s', (t) => expect(customDeficitError(t)).toBeNull());
  it.each(['', '   ', '0', '50', '75', '1050', '1100', 'abc', '99', '125', '12.5', '-100', '+100', '1e3', '1,000', '100.0', '5 00'])('rejects "%s"', (t) => expect(customDeficitError(t)).toEqual(expect.any(String)));

  it('labels tiles', () => {
    expect(tileLabel(250)).toBe('250 gentle');
    expect(tileLabel(750)).toBe('750 faster');
    expect(tileLabel(600)).toBe('600 kcal');
  });
});

describe('panel', () => {
  it('rounds half up, groups thousands and keeps zero', () => {
    expect(panelA11y({ calorieGoal: 1234567.5, proteinGoal: 0.4, carbGoal: 99.5, fatGoal: 999.4 })).toBe(
      'Daily goal 1,234,568 calories, protein 0 grams, carbs 100 grams, fat 999 grams',
    );
    expect(panelA11y({ calorieGoal: 999.5, proteinGoal: 1, carbGoal: 1, fatGoal: 1 })).toMatch(/^Daily goal 1,000 calories/);
  });

  it('has empty copy and a rounded, grouped a11y label', () => {
    expect(PANEL_EMPTY).toBe('Fill in the details above to see your goal');
    expect(panelA11y({ calorieGoal: 2200.4, proteinGoal: 149.6, carbGoal: 240, fatGoal: 70 })).toBe(
      'Daily goal 2,200 calories, protein 150 grams, carbs 240 grams, fat 70 grams',
    );
  });
});
