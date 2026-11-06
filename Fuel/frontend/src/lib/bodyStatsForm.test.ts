import {
  BODY_STATS_MESSAGES as M,
  convertUnits,
  emptyBodyStatsForm,
  formFromBodyStats,
  validateBodyStats,
  type BodyStatsForm,
} from './bodyStatsForm';

const metric = (over: Partial<BodyStatsForm> = {}): BodyStatsForm => ({
  ...emptyBodyStatsForm('metric'),
  age: '30',
  heightCm: '180',
  weight: '80',
  gender: 'MALE',
  activityLevel: 'LIGHT',
  ...over,
});
const imperial = (over: Partial<BodyStatsForm> = {}): BodyStatsForm => ({
  ...metric(),
  units: 'imperial',
  heightCm: '',
  heightFt: '5',
  heightIn: '11',
  weight: '176',
  ...over,
});

describe('validateBodyStats', () => {
  it('builds a metric request', () => {
    expect(validateBodyStats(metric())).toEqual({
      errors: {},
      input: { height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 30, gender: 'MALE', activityLevel: 'LIGHT' },
    });
  });

  it('builds an imperial request in decimal feet and lbs', () => {
    const { input } = validateBodyStats(imperial());
    expect(input).toMatchObject({ height: 5.917, heightUnit: 'ft', weight: 176, weightUnit: 'lbs' });
  });

  it('treats blank inches as zero', () => {
    expect(validateBodyStats(imperial({ heightIn: '' })).input?.height).toBe(5);
  });

  it('accepts a decimal comma', () => {
    expect(validateBodyStats(metric({ weight: '72,5' })).input?.weight).toBe(72.5);
  });

  it.each(['', 'abc', '1e3', '1.2.3', '-5', '0', '   '])('rejects weight %j', (w) => {
    const { errors, input } = validateBodyStats(metric({ weight: w }));
    expect(errors.weight).toBeDefined();
    expect(input).toBeUndefined();
  });

  it('rejects weight over the server limit and accepts the limit', () => {
    expect(validateBodyStats(metric({ weight: '2001' })).errors.weight).toBe(M.weightInvalid);
    expect(validateBodyStats(metric({ weight: '2000' })).errors.weight).toBeUndefined();
  });

  it.each([
    ['12', true],
    ['13', false],
    ['120', false],
    ['121', true],
    ['25.5', true],
    ['', true],
  ])('age %j rejected=%s', (age, bad) => {
    expect(validateBodyStats(metric({ age })).errors.age !== undefined).toBe(bad);
  });

  it('requires gender and activity level', () => {
    const { errors } = validateBodyStats(metric({ gender: null, activityLevel: null }));
    expect(errors.gender).toBe(M.genderRequired);
    expect(errors.activityLevel).toBe(M.activityRequired);
  });

  it.each([
    ['inches 12', { heightIn: '12' }, M.inchesInvalid],
    ['feet blank, inches filled', { heightFt: '', heightIn: '5' }, M.feetInvalid],
    ['both blank', { heightFt: '', heightIn: '' }, M.heightRequired],
    ['fractional feet', { heightFt: '5.5' }, M.feetInvalid],
    ['zero height', { heightFt: '0', heightIn: '0' }, M.heightInvalid],
  ])('imperial height rejects %s', (_n, over, msg) => {
    expect(validateBodyStats(imperial(over)).errors.height).toBe(msg);
  });

  it('rejects metric height of zero or over 1000', () => {
    expect(validateBodyStats(metric({ heightCm: '0' })).errors.height).toBe(M.heightInvalid);
    expect(validateBodyStats(metric({ heightCm: '1001' })).errors.height).toBe(M.heightInvalid);
  });

  it('never puts typed values in error text', () => {
    const { errors } = validateBodyStats(metric({ weight: '98765x', age: '999' }));
    expect(JSON.stringify(errors)).not.toMatch(/98765|999/);
  });
});

describe('convertUnits', () => {
  it('returns the same form for the same units', () => {
    const f = metric();
    expect(convertUnits(f, 'metric')).toBe(f);
  });

  it('converts metric to imperial', () => {
    const r = convertUnits(metric({ heightCm: '180', weight: '80' }), 'imperial');
    expect(r).toMatchObject({ units: 'imperial', heightFt: '5', heightIn: '10.9', weight: '176.4' });
  });

  it('round trip drifts no more than 0.1', () => {
    const back = convertUnits(convertUnits(metric({ heightCm: '175', weight: '72.5' }), 'imperial'), 'metric');
    expect(Math.abs(Number(back.heightCm) - 175)).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(Math.abs(Number(back.weight) - 72.5)).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('keeps blanks blank', () => {
    const r = convertUnits(metric({ heightCm: '', weight: ' ' }), 'imperial');
    expect(r).toMatchObject({ heightFt: '', heightIn: '', weight: '' });
    const b = convertUnits(imperial({ heightFt: '', heightIn: '', weight: '' }), 'metric');
    expect(b).toMatchObject({ heightCm: '', weight: '' });
  });

  it('leaves invalid text untouched', () => {
    const r = convertUnits(metric({ heightCm: 'abc', weight: '1e3' }), 'imperial');
    expect(r.weight).toBe('1e3');
    expect(r.heightFt).toBe('');
    const b = convertUnits(imperial({ heightFt: '', heightIn: '5', weight: 'x' }), 'metric');
    expect(b.weight).toBe('x');
    expect(b.heightCm).toBe('');
    expect(JSON.stringify(r)).not.toContain('NaN');
  });

  it('carries the other fields through', () => {
    expect(convertUnits(metric(), 'imperial')).toMatchObject({ age: '30', gender: 'MALE', activityLevel: 'LIGHT' });
  });

  it('rolls 11.95 inches up to the next foot', () => {
    // 182.8 cm = 71.97 in
    const r = convertUnits(metric({ heightCm: '182.8' }), 'imperial');
    expect(r).toMatchObject({ heightFt: '6', heightIn: '0' });
  });
});

describe('formFromBodyStats', () => {
  const saved = {
    height: 180, heightUnit: 'cm', weight: 80, weightUnit: 'kg', age: 30, gender: 'FEMALE',
    activityLevel: 'ACTIVE', updatedAt: '2026-01-01T00:00:00Z',
  } as const;

  it('seeds a metric form', () => {
    expect(formFromBodyStats(saved, 'metric')).toEqual({
      units: 'metric', age: '30', heightCm: '180', heightFt: '', heightIn: '', weight: '80',
      gender: 'FEMALE', activityLevel: 'ACTIVE',
    });
  });

  it('seeds an imperial form', () => {
    expect(formFromBodyStats(saved, 'imperial')).toMatchObject({
      units: 'imperial', heightFt: '5', heightIn: '10.9', weight: '176.4',
    });
  });

  it('seeded form validates', () => {
    expect(validateBodyStats(formFromBodyStats(saved, 'imperial')).input).toBeDefined();
  });
});
