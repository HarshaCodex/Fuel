import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getGoals, putGoals, userKeys } from '@/api/user';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { mapFieldErrors } from '@/lib/fieldErrors';
import {
  formFromGoals,
  GOALS_FIELDS,
  GOALS_MESSAGES,
  macroCheck,
  validateGoals,
  type GoalsField,
  type GoalsForm,
} from '@/lib/goalsForm';
import { sizing, space, type, useTheme } from '@/theme';

const EMPTY: GoalsForm = { calories: '', protein: '', carbs: '', fat: '' };

export default function EditGoalsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const goals = useQuery({ queryKey: userKeys.goals, queryFn: getGoals });
  const [form, setForm] = useState<GoalsForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<GoalsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const seeded = useRef(false);
  const busy = useRef(false);

  // Seed once; a later refetch must never overwrite what the user typed.
  useEffect(() => {
    if (goals.data && !seeded.current) {
      seeded.current = true;
      setForm(formFromGoals(goals.data));
      setReady(true);
    }
  }, [goals.data]);

  function edit(patch: Partial<GoalsForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save() {
    if (busy.current) return;
    const { errors: found, input } = validateGoals(form);
    setErrors(found);
    setBanner(null);
    if (!input) return;
    busy.current = true;
    setSaving(true);
    try {
      const saved = await putGoals(input);
      queryClient.setQueryData(userKeys.goals, saved);
      void queryClient.invalidateQueries({ queryKey: userKeys.goals });
      router.back();
    } catch (e) {
      const mapped = mapFieldErrors(e, GOALS_FIELDS);
      const hasMapped = Object.keys(mapped.errors).length > 0;
      if (hasMapped) setErrors(mapped.errors);
      const { kind, retryAfter } = classifyAuthError(e);
      if (hasMapped && !mapped.hasUnmatched) setBanner(null);
      else if (kind === 'invalid') setBanner(GOALS_MESSAGES.unmatched);
      else if (kind === 'offline') setBanner(GOALS_MESSAGES.offline);
      else if (kind === 'rateLimited') setBanner(rateLimitMessage(retryAfter));
      else setBanner(GOALS_MESSAGES.generic);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const check = macroCheck(form);
  const loadError = goals.isError && !goals.data;

  return (
    <FormScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close} hitSlop={space.sm}>
          <Ionicons name="close" size={sizing.icon} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Edit goals
      </Text>
      {loadError ? (
        <Banner
          variant="danger"
          message={classifyAuthError(goals.error).kind === 'offline' ? GOALS_MESSAGES.offline : GOALS_MESSAGES.loadFailed}
          action={{ label: 'Retry', onPress: () => void goals.refetch() }}
        />
      ) : !ready ? (
        <Text style={[type.callout, { color: colors.textSecondary }]}>Loading goals</Text>
      ) : (
        <>
          {banner ? <Banner variant="danger" message={banner} /> : null}
          <TextField label="Calories" value={form.calories} onChangeText={(calories) => edit({ calories })} error={errors.calorieGoal} keyboardType="number-pad" />
          <TextField label="Protein (g)" value={form.protein} onChangeText={(protein) => edit({ protein })} error={errors.proteinGoal} keyboardType="decimal-pad" />
          <TextField label="Carbs (g)" value={form.carbs} onChangeText={(carbs) => edit({ carbs })} error={errors.carbGoal} keyboardType="decimal-pad" />
          <TextField label="Fat (g)" value={form.fat} onChangeText={(fat) => edit({ fat })} error={errors.fatGoal} keyboardType="decimal-pad" />
          {check ? (
            <Banner
              variant={check.percent === 100 ? 'success' : 'caution'}
              message={`= ${check.percent}% of your calories`}
            />
          ) : null}
          <Button label="Save" onPress={() => void save()} loading={saving} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  close: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
});
