import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { trackingKeys } from '@/api/tracking';
import { getProfile, putProfile, userKeys } from '@/api/user';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { classifyAuthError, rateLimitMessage } from '@/lib/authErrors';
import { mapFieldErrors } from '@/lib/fieldErrors';
import {
  formFromProfile,
  PROFILE_FIELDS,
  PROFILE_MESSAGES,
  validateProfile,
  type ProfileField,
  type ProfileForm,
} from '@/lib/profileForm';
import { deviceTimezone, filterTimezones, orderTimezones } from '@/lib/timezones';
import { radius, sizing, space, type, useTheme } from '@/theme';

const EMPTY: ProfileForm = { name: '', timezone: '' };
const HTTP_NOT_FOUND = 404;

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: userKeys.profile, queryFn: getProfile });
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [original, setOriginal] = useState<ProfileForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const seeded = useRef(false);
  const busy = useRef(false);

  // Seed once; a later refetch must never overwrite what the user typed.
  useEffect(() => {
    if (profile.data && !seeded.current) {
      seeded.current = true;
      const seed = formFromProfile(profile.data);
      setForm(seed);
      setOriginal(seed);
      setReady(true);
    }
  }, [profile.data]);

  const zones = useMemo(
    () => filterTimezones(orderTimezones(deviceTimezone(), original.timezone), query),
    [original.timezone, query],
  );

  // Invalid values keep Save enabled so the user sees why; only an untouched form is disabled.
  const check = validateProfile(form.name, form.timezone, original);
  const changed = check.input !== null || Object.keys(check.errors).length > 0;

  async function save() {
    if (busy.current) return;
    const { errors: found, input } = validateProfile(form.name, form.timezone, original);
    setErrors(found);
    setBanner(null);
    if (!input) return;
    busy.current = true;
    setSaving(true);
    try {
      const saved = await putProfile(input);
      queryClient.setQueryData(userKeys.profile, saved);
      // The timezone decides which day is today, so dashboards and history may now be stale.
      void queryClient.invalidateQueries({ queryKey: trackingKeys.all });
      router.back();
    } catch (e) {
      const mapped = mapFieldErrors(e, PROFILE_FIELDS);
      const hasMapped = Object.keys(mapped.errors).length > 0;
      if (hasMapped) setErrors(mapped.errors);
      const { kind, retryAfter } = classifyAuthError(e);
      if (e instanceof ApiError && e.status === HTTP_NOT_FOUND) setBanner(PROFILE_MESSAGES.notFound);
      else if (hasMapped && !mapped.hasUnmatched) setBanner(null);
      else if (kind === 'invalid') setBanner(PROFILE_MESSAGES.unmatched);
      else if (kind === 'offline') setBanner(PROFILE_MESSAGES.offline);
      else if (kind === 'rateLimited') setBanner(rateLimitMessage(retryAfter));
      else setBanner(PROFILE_MESSAGES.generic);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function closePicker() {
    setPicking(false);
    setQuery('');
  }

  function choose(timezone: string) {
    setForm((f) => ({ ...f, timezone }));
    closePicker();
  }

  const loadError = profile.isError && !profile.data;

  return (
    <FormScreen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={picking ? 'Back to profile' : 'Close'}
          onPress={() => (picking ? closePicker() : router.back())}
          style={styles.close}
          hitSlop={space.sm}
        >
          <Ionicons name={picking ? 'chevron-back' : 'close'} size={sizing.icon} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        {picking ? 'Timezone' : 'Edit profile'}
      </Text>
      {loadError ? (
        <Banner
          variant="danger"
          message={classifyAuthError(profile.error).kind === 'offline' ? PROFILE_MESSAGES.offline : PROFILE_MESSAGES.loadFailed}
          action={{ label: 'Retry', onPress: () => void profile.refetch() }}
        />
      ) : !ready ? (
        <Text style={[type.callout, { color: colors.textSecondary }]}>Loading profile</Text>
      ) : picking ? (
        <>
          <TextField label="Search timezones" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          {zones.length === 0 ? (
            <Text style={[type.callout, { color: colors.textSecondary }]}>No timezones match</Text>
          ) : (
            zones.map((zone) => (
              <Pressable
                key={zone}
                accessibilityRole="button"
                accessibilityLabel={zone}
                accessibilityState={{ selected: zone === form.timezone }}
                onPress={() => choose(zone)}
                style={({ pressed }) => [
                  styles.zone,
                  { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[type.body, styles.zoneText, { color: colors.text }]} maxFontSizeMultiplier={2}>{zone}</Text>
                {zone === form.timezone ? <Ionicons name="checkmark" size={sizing.icon} color={colors.accent} /> : null}
              </Pressable>
            ))
          )}
        </>
      ) : (
        <>
          {banner ? <Banner variant="danger" message={banner} /> : null}
          <TextField
            label="Name"
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            error={errors.name}
            autoCapitalize="words"
            autoComplete="name"
          />
          <View style={styles.tz}>
            <Text style={[type.caption, { color: colors.textSecondary }]}>Timezone</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Timezone, ${form.timezone}`}
              onPress={() => setPicking(true)}
              style={[styles.zone, { backgroundColor: colors.surface, borderColor: errors.timezone ? colors.danger : colors.borderStrong }]}
            >
              <Text style={[type.body, styles.zoneText, { color: colors.text }]} maxFontSizeMultiplier={2}>{form.timezone}</Text>
              <Text style={[type.headline, { color: colors.textTertiary }]} accessibilityElementsHidden importantForAccessibility="no">›</Text>
            </Pressable>
            {errors.timezone ? <Text style={[type.caption, { color: colors.danger }]}>{errors.timezone}</Text> : null}
          </View>
          <Button label="Save" onPress={() => void save()} loading={saving} disabled={!changed} />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  close: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  tz: { gap: space.xs },
  zone: {
    minHeight: sizing.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: sizing.border,
  },
  zoneText: { flex: 1 },
});
