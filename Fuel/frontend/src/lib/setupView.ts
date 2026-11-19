import type { GoalsInput } from '@/api/user';

import { ACTIVITIES, validateBodyStats, type BodyStatsField, type BodyStatsForm } from './bodyStatsForm';
import { formatKcal } from './dashboardView';

export type SetupRowKey = BodyStatsField;
export type SetupRow = { key: SetupRowKey; label: string; value?: string; a11y: string };

const GENDER_LABEL = { MALE: 'Male', FEMALE: 'Female' } as const;
const ROW_LABELS: Record<SetupRowKey, string> = { age: 'Age', gender: 'Sex', height: 'Height', weight: 'Weight', activityLevel: 'Activity' };

const filled = (s: string) => (s.trim() ? s.trim() : undefined);

function heightValue(form: BodyStatsForm): string | undefined {
  if (form.units === 'metric') {
    const cm = filled(form.heightCm);
    return cm && `${cm} cm`;
  }
  const ft = filled(form.heightFt);
  const inch = filled(form.heightIn);
  if (!ft && !inch) return undefined;
  return [ft && `${ft} ft`, inch && `${inch} in`].filter(Boolean).join(' ');
}

function weightValue(form: BodyStatsForm): string | undefined {
  const w = filled(form.weight);
  return w && `${w} ${form.units === 'metric' ? 'kg' : 'lb'}`;
}

/** The five rows of the Setup page. `value` is undefined when nothing is entered; the UI then shows "Add". */
export function setupRows(form: BodyStatsForm): SetupRow[] {
  const values: Record<SetupRowKey, string | undefined> = {
    age: filled(form.age),
    gender: form.gender ? GENDER_LABEL[form.gender] : undefined,
    height: heightValue(form),
    weight: weightValue(form),
    activityLevel: form.activityLevel ? ACTIVITIES.find((a) => a.value === form.activityLevel)?.label : undefined,
  };
  return (Object.keys(ROW_LABELS) as SetupRowKey[]).map((key) => ({
    key,
    label: ROW_LABELS[key],
    value: values[key],
    a11y: `${ROW_LABELS[key]}, ${values[key] ?? 'not set'}`,
  }));
}

/** The validation message for one row, or undefined when it is valid. Height covers cm, ft and in. */
export const rowError = (form: BodyStatsForm, key: SetupRowKey): string | undefined => validateBodyStats(form).errors[key];

export const allValid = (form: BodyStatsForm): boolean => Object.keys(validateBodyStats(form).errors).length === 0;

export const DAILY_CHANGES = [
  { value: 250, label: 'gentle' },
  { value: 500, label: 'steady' },
  { value: 750, label: 'faster' },
] as const;
export const DEFAULT_DEFICIT = 500;

export const isPreset = (d: number): boolean => DAILY_CHANGES.some((c) => c.value === d);

const MIN_CHANGE = 100;
const MAX_CHANGE = 1000;
const CHANGE_STEP = 50;
export const CUSTOM_CHANGE_MESSAGE = `Enter a whole number from ${MIN_CHANGE} to ${MAX_CHANGE} in steps of ${CHANGE_STEP}`;

/** Null when `text` is a valid custom daily change: an integer from 100 to 1000 in steps of 50. */
export function customDeficitError(text: string): string | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return CUSTOM_CHANGE_MESSAGE;
  const n = Number(t);
  return n >= MIN_CHANGE && n <= MAX_CHANGE && n % CHANGE_STEP === 0 ? null : CUSTOM_CHANGE_MESSAGE;
}

/** "250 gentle" for presets, "<n> kcal" for a custom amount. */
export function tileLabel(d: number): string {
  const preset = DAILY_CHANGES.find((c) => c.value === d);
  return preset ? `${preset.value} ${preset.label}` : `${d} kcal`;
}

export const PANEL_EMPTY = 'Fill in the details above to see your goal';

export function panelA11y(g: GoalsInput): string {
  return `Daily goal ${formatKcal(g.calorieGoal)} calories, protein ${formatKcal(g.proteinGoal)} grams, carbs ${formatKcal(g.carbGoal)} grams, fat ${formatKcal(g.fatGoal)} grams`;
}
