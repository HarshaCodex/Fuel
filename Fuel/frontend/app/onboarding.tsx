import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { putBodyStats, recalculateGoals, userKeys, type GoalType, type RecalculatedGoals } from '@/api/user';
import { Banner } from '@/components/Banner';
import { ChangeTiles } from '@/components/ChangeTiles';
import { PillGroup } from '@/components/PillGroup';
import { SetupPanel } from '@/components/SetupPanel';
import { SetupRows } from '@/components/SetupRows';
import { ChoiceSheet, CustomChangeSheet, StatSheet, type StatKind } from '@/components/SetupSheets';
import { classifyAuthError } from '@/lib/authErrors';
import {
  BODY_STATS_FIELDS,
  BODY_STATS_UI,
  convertUnits,
  emptyBodyStatsForm,
  UNIT_OPTIONS,
  validateBodyStats,
  type BodyStatsField,
  type BodyStatsForm,
  type Units,
} from '@/lib/bodyStatsForm';
import { mapFieldErrors } from '@/lib/fieldErrors';
import { allValid, customDeficitError, DEFAULT_DEFICIT, isPreset, setupRows, type SetupRowKey } from '@/lib/setupView';
import { setOnboardingSkipped } from '@/lib/tokenStorage';
import { sizing, space, type, useTheme } from '@/theme';

const GENERIC = "Couldn't calculate your goal. Try again.";
const GOALS = [
  { value: 'LOSE', label: 'Lose' },
  { value: 'MAINTAIN', label: 'Maintain' },
  { value: 'GAIN', label: 'Gain' },
] as const;
const STAT_KEYS: readonly SetupRowKey[] = ['age', 'height', 'weight'];

type Calc = { status: 'idle' | 'loading' | 'ok' | 'error'; goals?: RecalculatedGoals; message?: string };
type Snapshot = { form: BodyStatsForm; saved: boolean };

/** One-page setup: five body-stat rows, a goal and a pinned live result. */
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BodyStatsForm>(() => emptyBodyStatsForm());
  const [serverErrors, setServerErrors] = useState<Partial<Record<BodyStatsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [goal, setGoal] = useState<GoalType>('MAINTAIN');
  const [deficit, setDeficit] = useState<number>(DEFAULT_DEFICIT);
  const [calc, setCalc] = useState<Calc>({ status: 'idle' });
  const [sheet, setSheet] = useState<SetupRowKey | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const saved = useRef(false);
  const requestId = useRef(0);
  const finishing = useRef(false);
  const version = useRef(0); // bumped on every body-stat edit
  const snapshot = useRef<Snapshot>({ form, saved: false });

  async function calculate(f: BodyStatsForm, g: GoalType, d: number) {
    const id = ++requestId.current;
    const startedAt = version.current;
    setBanner(null);
    // Keep the last numbers on screen (dimmed) while the next ones load.
    setCalc((c) => ({ status: 'loading', goals: c.goals }));
    try {
      const { input } = validateBodyStats(f);
      if (!saved.current && input) {
        await putBodyStats(input);
        // A newer request or an edit since this one started means the saved copy may be stale.
        if (id === requestId.current && startedAt === version.current) saved.current = true;
      }
      const goals = await recalculateGoals(g === 'MAINTAIN' ? { goal: g } : { goal: g, deficit: d });
      if (id === requestId.current) setCalc({ status: 'ok', goals });
    } catch (e) {
      if (id !== requestId.current) return;
      const mapped = mapFieldErrors(e, BODY_STATS_FIELDS);
      if (Object.keys(mapped.errors).length > 0 || mapped.hasUnmatched) {
        setServerErrors(mapped.errors);
        setBanner(BODY_STATS_UI.unmatched);
        setCalc({ status: 'idle' });
      } else {
        setCalc({ status: 'error', message: classifyAuthError(e).kind === 'offline' ? BODY_STATS_UI.offline : GENERIC });
      }
    }
  }

  /** Recalculates once all five answers are valid; until then the panel keeps its empty copy. */
  function refresh(f: BodyStatsForm, g: GoalType, d: number) {
    if (allValid(f)) void calculate(f, g, d);
  }

  function commit(next: BodyStatsForm) {
    setSheet(null);
    if (JSON.stringify(next) === JSON.stringify(snapshot.current.form)) {
      saved.current = snapshot.current.saved; // nothing changed, so the saved copy is still current
      return;
    }
    setServerErrors({});
    refresh(next, goal, deficit);
  }

  // The sheet edits the form as you type; closing without Done puts back what was there.
  function revert() {
    setForm(snapshot.current.form);
    saved.current = snapshot.current.saved;
    setSheet(null);
  }

  function open(key: SetupRowKey) {
    snapshot.current = { form, saved: saved.current };
    setSheet(key);
  }

  function edit(patch: Partial<BodyStatsForm>) {
    saved.current = false; // body stats changed, so they must be saved again before calculating
    version.current += 1;
    setForm((f) => ({ ...f, ...patch }));
  }

  function choose(patch: Partial<BodyStatsForm>) {
    edit(patch);
    commit({ ...form, ...patch });
  }

  function changeUnits(u: Units) {
    if (u === form.units) return;
    saved.current = false;
    version.current += 1;
    const next = convertUnits(form, u);
    setForm(next);
    setServerErrors({});
    refresh(next, goal, deficit);
  }

  function pickGoal(g: GoalType) {
    setGoal(g);
    refresh(form, g, deficit);
  }

  function pickDeficit(d: number) {
    setDeficit(d);
    refresh(form, goal, d);
  }

  function openCustom() {
    setCustomText(isPreset(deficit) ? '' : String(deficit));
    setCustomOpen(true);
  }

  function doneCustom() {
    if (customDeficitError(customText)) return;
    setCustomOpen(false);
    pickDeficit(Number(customText));
  }

  function finish() {
    if (finishing.current) return; // a double tap must not navigate twice
    finishing.current = true;
    void queryClient.invalidateQueries({ queryKey: userKeys.bodyStats });
    void queryClient.invalidateQueries({ queryKey: userKeys.goals });
    router.replace('/');
  }

  async function later() {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await setOnboardingSkipped();
    } catch {
      // Not persisted: the prompt may show again next launch, which is acceptable.
    }
    router.replace('/');
  }

  const statKind = sheet && STAT_KEYS.includes(sheet) ? (sheet as StatKind) : null;
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[type.title1, styles.title, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
            Set up your goal
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Later" onPress={() => void later()} style={styles.later}>
            <Text style={[type.link, { color: colors.accentText }]} maxFontSizeMultiplier={2}>
              Later
            </Text>
          </Pressable>
        </View>
        {banner ? <Banner variant="danger" message={banner} /> : null}

        <View style={styles.eyebrowRow}>
          <Text style={[type.eyebrow, { color: colors.textSecondary }]} accessibilityRole="header">
            About you
          </Text>
          <PillGroup label="Units" options={UNIT_OPTIONS} value={form.units} onChange={changeUnits} />
        </View>
        <SetupRows rows={setupRows(form)} onPress={open} errors={serverErrors} />

        <Text style={[type.eyebrow, { color: colors.textSecondary }]} accessibilityRole="header">
          Goal
        </Text>
        <PillGroup variant="accent" label="Goal" options={GOALS} value={goal} onChange={pickGoal} />
        {goal !== 'MAINTAIN' ? <ChangeTiles value={deficit} onSelect={pickDeficit} onCustom={openCustom} /> : null}
      </ScrollView>

      {calc.status === 'error' ? (
        <View style={styles.errorBanner}>
          <Banner variant="danger" message={calc.message ?? GENERIC} action={{ label: 'Retry', onPress: () => refresh(form, goal, deficit) }} />
        </View>
      ) : null}
      <SetupPanel goals={calc.status === 'error' ? undefined : calc.goals} calculating={calc.status === 'loading'} onStart={finish} />

      <StatSheet kind={statKind} form={form} onChange={edit} onDone={() => commit(form)} onClose={revert} />
      <ChoiceSheet kind="sex" visible={sheet === 'gender'} value={form.gender} onSelect={(gender) => choose({ gender })} onClose={revert} />
      <ChoiceSheet
        kind="activity"
        visible={sheet === 'activityLevel'}
        value={form.activityLevel}
        onSelect={(activityLevel) => choose({ activityLevel })}
        onClose={revert}
      />
      <CustomChangeSheet visible={customOpen} value={customText} onChange={setCustomText} onDone={doneCustom} onClose={() => setCustomOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: sizing.pageMargin, paddingBottom: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  later: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrowRow: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  errorBanner: { paddingHorizontal: sizing.pageMargin, paddingBottom: space.md },
});
