import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  putBodyStats,
  recalculateGoals,
  userKeys,
  type ActivityLevel,
  type GoalType,
  type RecalculatedGoals,
} from '@/api/user';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { OptionRow } from '@/components/OptionRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { classifyAuthError } from '@/lib/authErrors';
import {
  BODY_STATS_FIELDS,
  convertUnits,
  emptyBodyStatsForm,
  validateBodyStats,
  type BodyStatsField,
  type BodyStatsForm,
  type Units,
} from '@/lib/bodyStatsForm';
import { mapFieldErrors } from '@/lib/fieldErrors';
import { radius, sizing, space, type, useTheme } from '@/theme';

const OFFLINE = "You're offline. Check your connection and try again.";
const GENERIC = "Couldn't calculate your goal. Try again.";
const UNMATCHED = 'Some details were not accepted. Check your answers and try again.';
const STEP1_FIELDS: readonly BodyStatsField[] = ['age', 'gender', 'height', 'weight'];

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
] as const;
const UNIT_OPTIONS = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
] as const;
const GOALS = [
  { value: 'LOSE', label: 'Lose' },
  { value: 'MAINTAIN', label: 'Maintain' },
  { value: 'GAIN', label: 'Gain' },
] as const;
const ACTIVITIES: readonly { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'SEDENTARY', label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: 'LIGHT', label: 'Lightly active', description: 'Light exercise 1 to 3 days a week' },
  { value: 'MODERATE', label: 'Moderately active', description: 'Moderate exercise 3 to 5 days a week' },
  { value: 'ACTIVE', label: 'Active', description: 'Hard exercise 6 to 7 days a week' },
  { value: 'VERY_ACTIVE', label: 'Very active', description: 'Hard daily exercise or a physical job' },
];
const TITLES = ['About you', 'How active are you?', 'Your goal'] as const;
const DEFICIT = { min: 100, max: 1000, step: 50, initial: 500 } as const;

type Step = 0 | 1 | 2;
type Calc = { status: 'idle' | 'loading' } | { status: 'ok'; goals: RecalculatedGoals } | { status: 'error'; message: string };

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<BodyStatsForm>(() => emptyBodyStatsForm());
  const [errors, setErrors] = useState<Partial<Record<BodyStatsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [goal, setGoal] = useState<GoalType>('MAINTAIN');
  const [deficit, setDeficit] = useState<number>(DEFICIT.initial);
  const [calc, setCalc] = useState<Calc>({ status: 'idle' });
  const saved = useRef(false);
  const requestId = useRef(0);

  function edit(patch: Partial<BodyStatsForm>) {
    saved.current = false; // body stats changed, so they must be saved again before calculating
    setForm((f) => ({ ...f, ...patch }));
  }

  function next() {
    const { errors: all } = validateBodyStats(form);
    const relevant = step === 0 ? STEP1_FIELDS : (['activityLevel'] as const);
    const found = Object.fromEntries(relevant.filter((k) => all[k]).map((k) => [k, all[k]]));
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step === 0) setStep(1);
    else {
      setStep(2);
      void calculate(goal, deficit);
    }
  }

  async function calculate(g: GoalType, d: number) {
    const id = ++requestId.current;
    setCalc({ status: 'loading' });
    try {
      const { input } = validateBodyStats(form);
      if (!saved.current && input) {
        await putBodyStats(input);
        saved.current = true;
      }
      const goals = await recalculateGoals(g === 'MAINTAIN' ? { goal: g } : { goal: g, deficit: d });
      if (id === requestId.current) setCalc({ status: 'ok', goals });
    } catch (e) {
      if (id !== requestId.current) return;
      const mapped = mapFieldErrors(e, BODY_STATS_FIELDS);
      if (Object.keys(mapped.errors).length > 0 || mapped.hasUnmatched) {
        setErrors(mapped.errors);
        setBanner(UNMATCHED);
        setStep(0);
        setCalc({ status: 'idle' });
      } else {
        setCalc({ status: 'error', message: classifyAuthError(e).kind === 'offline' ? OFFLINE : GENERIC });
      }
    }
  }

  function pickGoal(g: GoalType) {
    setGoal(g);
    void calculate(g, deficit);
  }

  function pickDeficit(d: number) {
    setDeficit(d);
    void calculate(goal, d);
  }

  function finish() {
    void queryClient.invalidateQueries({ queryKey: userKeys.bodyStats });
    void queryClient.invalidateQueries({ queryKey: userKeys.goals });
    router.replace('/');
  }

  function back() {
    requestId.current++; // drop any in-flight calculation
    setBanner(null);
    setStep((s) => (s > 0 ? ((s - 1) as Step) : s));
  }

  const imperial = form.units === 'imperial';
  return (
    <FormScreen>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Step ${step + 1} of 3`}
        accessibilityRole="progressbar"
      >
        {TITLES.map((t, i) => (
          <View key={t} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.border }]} />
        ))}
      </View>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        {TITLES[step]}
      </Text>
      {banner ? <Banner variant="danger" message={banner} /> : null}

      {step === 0 ? (
        <>
          <TextField
            label="Age"
            value={form.age}
            onChangeText={(age) => edit({ age })}
            error={errors.age}
            keyboardType="number-pad"
          />
          <SegmentedControl label="Gender" options={GENDERS} value={form.gender} onChange={(gender) => edit({ gender })} />
          {errors.gender ? <Text style={[type.caption, { color: colors.danger }]}>{errors.gender}</Text> : null}
          <SegmentedControl
            label="Units"
            options={UNIT_OPTIONS}
            value={form.units}
            onChange={(u: Units) => u !== form.units && setForm(convertUnits(form, u))}
          />
          {imperial ? (
            <View style={styles.pair}>
              <View style={styles.half}>
                <TextField label="Height (ft)" value={form.heightFt} onChangeText={(heightFt) => edit({ heightFt })} keyboardType="number-pad" error={errors.height} />
              </View>
              <View style={styles.half}>
                <TextField label="Height (in)" value={form.heightIn} onChangeText={(heightIn) => edit({ heightIn })} keyboardType="decimal-pad" />
              </View>
            </View>
          ) : (
            <TextField label="Height (cm)" value={form.heightCm} onChangeText={(heightCm) => edit({ heightCm })} keyboardType="decimal-pad" error={errors.height} />
          )}
          <TextField
            label={imperial ? 'Weight (lbs)' : 'Weight (kg)'}
            value={form.weight}
            onChangeText={(weight) => edit({ weight })}
            keyboardType="decimal-pad"
            error={errors.weight}
          />
          <Button label="Next" onPress={next} />
          <Button variant="text" label="Set up later" onPress={() => router.replace('/')} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          {ACTIVITIES.map((a) => (
            <OptionRow
              key={a.value}
              label={a.label}
              description={a.description}
              selected={form.activityLevel === a.value}
              onPress={() => edit({ activityLevel: a.value })}
            />
          ))}
          {errors.activityLevel ? <Text style={[type.caption, { color: colors.danger }]}>{errors.activityLevel}</Text> : null}
          <Button label="Next" onPress={next} />
          <Button variant="text" label="Back" onPress={back} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <SegmentedControl label="Goal" options={GOALS} value={goal} onChange={pickGoal} />
          {goal !== 'MAINTAIN' ? (
            <Stepper
              label="Daily calorie change"
              value={deficit}
              min={DEFICIT.min}
              max={DEFICIT.max}
              step={DEFICIT.step}
              onChange={pickDeficit}
              format={(v) => `${v} kcal ${goal === 'LOSE' ? 'below' : 'above'} your maintenance`}
            />
          ) : null}
          {calc.status === 'error' ? (
            <Banner variant="danger" message={calc.message} action={{ label: 'Retry', onPress: () => void calculate(goal, deficit) }} />
          ) : null}
          {calc.status === 'ok' ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLiveRegion="polite">
              <Text style={[type.title2, { color: colors.text }]}>{`${Math.round(calc.goals.calorieGoal)} kcal a day`}</Text>
              <Text style={[type.callout, { color: colors.textSecondary }]}>
                {`Protein ${Math.round(calc.goals.proteinGoal)} g, Carbs ${Math.round(calc.goals.carbGoal)} g, Fat ${Math.round(calc.goals.fatGoal)} g`}
              </Text>
              <Text style={[type.caption, { color: colors.textSecondary }]}>You can change this anytime</Text>
            </View>
          ) : null}
          <Button label="Start tracking" onPress={finish} loading={calc.status === 'loading'} disabled={calc.status !== 'ok'} />
          <Button variant="text" label="Back" onPress={back} />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: space.xl, height: space.sm, borderRadius: radius.full },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  card: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.xs },
});
