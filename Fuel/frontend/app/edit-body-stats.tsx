import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getBodyStats, putBodyStats, userKeys } from '@/api/user';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { OptionRow } from '@/components/OptionRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import {
  ACTIVITIES,
  BODY_STATS_FIELDS,
  BODY_STATS_UI,
  convertUnits,
  emptyBodyStatsForm,
  formFromBodyStats,
  GENDERS,
  UNIT_OPTIONS,
  validateBodyStats,
  type BodyStatsField,
  type BodyStatsForm,
  type Units,
} from '@/lib/bodyStatsForm';
import { mapFieldErrors } from '@/lib/fieldErrors';
import { sizing, space, type, useTheme } from '@/theme';

export default function EditBodyStatsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const stats = useQuery({ queryKey: userKeys.bodyStats, queryFn: getBodyStats });
  const [form, setForm] = useState<BodyStatsForm>(() => emptyBodyStatsForm());
  const [errors, setErrors] = useState<Partial<Record<BodyStatsField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const seeded = useRef(false);
  const busy = useRef(false);

  // Seed once (null means nothing saved yet: start blank); a refetch must never overwrite typing.
  useEffect(() => {
    if (stats.data !== undefined && !seeded.current) {
      seeded.current = true;
      setForm(stats.data ? formFromBodyStats(stats.data, 'metric') : emptyBodyStatsForm());
      setReady(true);
    }
  }, [stats.data]);

  function edit(patch: Partial<BodyStatsForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save() {
    if (busy.current) return;
    const { errors: found, input } = validateBodyStats(form);
    setErrors(found);
    setBanner(null);
    if (!input) return;
    busy.current = true;
    setSaving(true);
    try {
      const saved = await putBodyStats(input);
      queryClient.setQueryData(userKeys.bodyStats, saved);
      void queryClient.invalidateQueries({ queryKey: userKeys.bodyStats });
      router.back();
    } catch (e) {
      const mapped = mapFieldErrors(e, BODY_STATS_FIELDS);
      const hasMapped = Object.keys(mapped.errors).length > 0;
      if (hasMapped) setErrors(mapped.errors);
      const { kind, retryAfter } = classifyAuthError(e);
      if (hasMapped && !mapped.hasUnmatched) setBanner(null);
      else if (kind === 'invalid') setBanner(BODY_STATS_UI.unmatched);
      else if (kind === 'offline') setBanner(BODY_STATS_UI.offline);
      else if (kind === 'rateLimited') setBanner(rateLimitMessage(retryAfter));
      else setBanner(BODY_STATS_UI.generic);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const imperial = form.units === 'imperial';
  const loadError = stats.isError && !stats.data && !ready;
  return (
    <FormScreen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close} hitSlop={space.sm}>
          <Ionicons name="close" size={sizing.icon} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Body stats
      </Text>
      {loadError ? (
        <Banner
          variant="danger"
          message={classifyAuthError(stats.error).kind === 'offline' ? BODY_STATS_UI.offline : BODY_STATS_UI.loadFailed}
          action={{ label: 'Retry', onPress: () => void stats.refetch() }}
        />
      ) : !ready ? (
        <Text style={[type.callout, { color: colors.textSecondary }]}>Loading body stats</Text>
      ) : (
        <>
          {banner ? <Banner variant="danger" message={banner} /> : null}
          <TextField label="Age" value={form.age} onChangeText={(age) => edit({ age })} error={errors.age} keyboardType="number-pad" />
          <SegmentedControl label="Gender" options={GENDERS} value={form.gender} onChange={(gender) => edit({ gender })} />
          {errors.gender ? <Text style={[type.caption, { color: colors.danger }]}>{errors.gender}</Text> : null}
          <SegmentedControl
            label="Units"
            options={UNIT_OPTIONS}
            value={form.units}
            onChange={(u: Units) => setForm((f) => convertUnits(f, u))}
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
          <Text style={[type.headline, { color: colors.text }]} accessibilityRole="header">
            Activity level
          </Text>
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
          <Button label="Save" onPress={() => void save()} loading={saving} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  close: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
