import type { ActivityLevel, BodyStats, BodyStatsInput, Gender } from '@/api/user';

export type Units = 'metric' | 'imperial';

export type BodyStatsForm = {
  units: Units;
  age: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  gender: Gender | null;
  activityLevel: ActivityLevel | null;
};

export type BodyStatsField = 'age' | 'gender' | 'height' | 'weight' | 'activityLevel';
export const BODY_STATS_FIELDS: readonly BodyStatsField[] = ['age', 'gender', 'height', 'weight', 'activityLevel'];

export const BODY_STATS_MESSAGES = {
  ageRequired: 'Enter your age',
  ageRange: 'Age must be a whole number from 13 to 120',
  genderRequired: 'Choose one',
  activityRequired: 'Choose your activity level',
  heightRequired: 'Enter your height',
  heightInvalid: 'Enter a valid height',
  feetInvalid: 'Feet must be a whole number',
  inchesInvalid: 'Inches must be from 0 to 11.9',
  weightRequired: 'Enter your weight',
  weightInvalid: 'Enter a valid weight',
} as const;

const MIN_AGE = 13;
const MAX_AGE = 120;
const MAX_HEIGHT = 1000;
const MAX_WEIGHT = 2000;
const MAX_INCHES = 12; // exclusive
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const LBS_PER_KG = 2.20462;
const FEET_DECIMALS = 1000;
const DISPLAY_DECIMALS = 10;

export const emptyBodyStatsForm = (units: Units = 'metric'): BodyStatsForm => ({
  units,
  age: '',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weight: '',
  gender: null,
  activityLevel: null,
});

/** Parses plain decimals (comma or dot). Returns null for blank, signs, exponents and junk. */
function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return null;
  return Number(t);
}

const roundTo = (n: number, scale: number) => Math.round(n * scale) / scale;
const show = (n: number) => String(roundTo(n, DISPLAY_DECIMALS));

function readHeight(form: BodyStatsForm): { value?: number; error?: string } {
  const m = BODY_STATS_MESSAGES;
  if (form.units === 'metric') {
    if (!form.heightCm.trim()) return { error: m.heightRequired };
    const cm = parseNumber(form.heightCm);
    return cm === null || cm <= 0 || cm > MAX_HEIGHT ? { error: m.heightInvalid } : { value: cm };
  }
  const ft = form.heightFt.trim();
  const inch = form.heightIn.trim();
  if (!ft && !inch) return { error: m.heightRequired };
  if (!ft) return { error: m.feetInvalid };
  if (!/^\d+$/.test(ft)) return { error: m.feetInvalid };
  const inches = inch ? parseNumber(inch) : 0;
  if (inches === null || inches >= MAX_INCHES) return { error: m.inchesInvalid };
  const feet = roundTo(Number(ft) + inches / INCHES_PER_FOOT, FEET_DECIMALS);
  return feet <= 0 || feet > MAX_HEIGHT ? { error: m.heightInvalid } : { value: feet };
}

export function validateBodyStats(form: BodyStatsForm): {
  errors: Partial<Record<BodyStatsField, string>>;
  input?: BodyStatsInput;
} {
  const m = BODY_STATS_MESSAGES;
  const errors: Partial<Record<BodyStatsField, string>> = {};

  const ageNum = parseNumber(form.age);
  if (!form.age.trim()) errors.age = m.ageRequired;
  else if (ageNum === null || !Number.isInteger(ageNum) || ageNum < MIN_AGE || ageNum > MAX_AGE) errors.age = m.ageRange;

  if (!form.gender) errors.gender = m.genderRequired;

  const height = readHeight(form);
  if (height.error) errors.height = height.error;

  const weightNum = parseNumber(form.weight);
  if (!form.weight.trim()) errors.weight = m.weightRequired;
  else if (weightNum === null || weightNum <= 0 || weightNum > MAX_WEIGHT) errors.weight = m.weightInvalid;

  if (!form.activityLevel) errors.activityLevel = m.activityRequired;

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors,
    input: {
      height: height.value as number,
      heightUnit: form.units === 'metric' ? 'cm' : 'ft',
      weight: weightNum as number,
      weightUnit: form.units === 'metric' ? 'kg' : 'lbs',
      age: ageNum as number,
      gender: form.gender as Gender,
      activityLevel: form.activityLevel as ActivityLevel,
    },
  };
}

/** Converts typed values between unit systems. Blanks stay blank; unparseable text is left untouched. */
export function convertUnits(form: BodyStatsForm, to: Units): BodyStatsForm {
  if (form.units === to) return form;
  const next: BodyStatsForm = { ...form, units: to };

  const weight = parseNumber(form.weight);
  if (!form.weight.trim()) next.weight = '';
  else if (weight !== null) next.weight = show(to === 'imperial' ? weight * LBS_PER_KG : weight / LBS_PER_KG);

  if (to === 'imperial') {
    const cm = parseNumber(form.heightCm);
    if (!form.heightCm.trim()) {
      next.heightFt = '';
      next.heightIn = '';
    } else if (cm !== null) {
      const totalIn = roundTo(cm / CM_PER_INCH, DISPLAY_DECIMALS);
      let feet = Math.floor(totalIn / INCHES_PER_FOOT);
      let inches = roundTo(totalIn - feet * INCHES_PER_FOOT, DISPLAY_DECIMALS);
      if (inches >= INCHES_PER_FOOT) {
        feet += 1;
        inches = 0;
      }
      next.heightFt = String(feet);
      next.heightIn = String(inches);
    }
  } else {
    const ft = form.heightFt.trim();
    const inch = form.heightIn.trim();
    const feet = parseNumber(ft);
    const inches = inch ? parseNumber(inch) : 0;
    if (!ft && !inch) next.heightCm = '';
    else if (feet !== null && inches !== null) {
      next.heightCm = show((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH);
    }
  }
  return next;
}

/** Seeds the edit form from a saved record (always cm/kg). */
export function formFromBodyStats(stats: BodyStats, units: Units): BodyStatsForm {
  const metric: BodyStatsForm = {
    units: 'metric',
    age: String(stats.age),
    heightCm: show(stats.height),
    heightFt: '',
    heightIn: '',
    weight: show(stats.weight),
    gender: stats.gender,
    activityLevel: stats.activityLevel,
  };
  return convertUnits(metric, units);
}
