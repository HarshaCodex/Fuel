import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '@/api/errors';
import { createCustomFood, foodKeys, getFood, updateCustomFood, type CustomFoodBody, type Food, type ServingUnit } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KeyboardAvoider, useKeyboardHeight } from '@/components/KeyboardAvoider';
import { StateBlock } from '@/components/StateBlock';
import { TextField } from '@/components/TextField';
import { UnitPicker } from '@/components/UnitPicker';
import {
  EMPTY_FORM,
  FIELDS,
  fieldError,
  fromFood,
  isDirty,
  macroHint,
  validateForm,
  type CustomFoodField,
  type FormValues,
} from '@/lib/customFoodForm';
import { mapFieldErrors } from '@/lib/fieldErrors';
import { hapticLight } from '@/lib/haptics';
import { mealForHour } from '@/lib/mealLabel';
import { sizing, space, type, useTheme } from '@/theme';

type Input = ComponentRef<typeof TextInput>;
type Fields = Partial<Record<CustomFoodField, string>>;
type Problem = { kind: 'offline' | 'generic' | 'log' | 'gone'; message: string };

const OFFLINE = "You're offline. Check your connection and try again.";
const GENERIC = "Couldn't save this food. Try again.";
const GONE = 'This food no longer exists.';
const GONE_TITLE = 'This food no longer exists';
const LOG_FAILED = "Saved to My Foods, but couldn't log it. Try again.";

export default function ManualEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const editing = !!id;
  const createOnly = mode === 'create' && !editing;

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormValues>(EMPTY_FORM);
  const [loaded, setLoaded] = useState(!editing);
  // Prefill from the cache My Foods seeded; otherwise fetch the food.
  const source = useQuery({ queryKey: foodKeys.detail(id ?? ''), queryFn: () => getFood(id as string), enabled: editing });
  if (editing && source.data && !loaded) {
    const filled = fromFood(source.data);
    setValues(filled);
    setInitial(filled);
    setLoaded(true);
  }
  const [touched, setTouched] = useState<Fields>({});
  const [serverErrors, setServerErrors] = useState<Fields>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [created, setCreated] = useState<Food | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const leaveRepeat = useRef<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);
  const keyboardUp = useKeyboardHeight() > 0;
  const dirty = isDirty(values, initial);
  const sending = useRef(false);
  const intentLogs = useRef(!createOnly);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const createdRef = useRef<Food | null>(null);
  const inputs = useRef<Partial<Record<CustomFoodField, Input | null>>>({});

  // Android back and the iOS swipe-back are blocked while typed values would be lost, so they ask first.
  usePreventRemove(dirty && !created && !leaving, ({ repeat }) => {
    leaveRepeat.current = repeat;
    setConfirmDiscard(true);
  });
  // Leave once prevention has dropped, so the blocked action is repeated against the new state.
  useEffect(() => {
    if (!leaving) return;
    const go = leaveRepeat.current;
    leaveRepeat.current = null;
    if (go) go();
    else router.back();
  }, [leaving, router]);

  const set = (field: CustomFoodField, text: string) => {
    setValues((v) => ({ ...v, [field]: text }));
    if (serverErrors[field]) setServerErrors((e) => ({ ...e, [field]: undefined }));
  };
  const blur = (field: CustomFoodField) => setTouched((t) => ({ ...t, [field]: 'yes' }));
  const errorFor = (field: CustomFoodField): string | null =>
    serverErrors[field] ?? (touched[field] ? fieldError(field, values) : null);
  const focusNext = (field: CustomFoodField) => {
    const next = FIELDS[FIELDS.indexOf(field) + 1];
    // Unit chips sit between serving size and calories, so skip them.
    inputs.current[next === 'servingUnit' ? 'calories' : next]?.focus();
  };

  const field = (name: CustomFoodField, label: string, extra: Partial<ComponentProps<typeof TextField>> = {}) => (
    <TextField
      key={name}
      ref={(r) => {
        inputs.current[name] = r;
      }}
      label={label}
      value={values[name]}
      onChangeText={(t) => set(name, t)}
      onBlur={() => blur(name)}
      error={errorFor(name)}
      editable={!busy && !created}
      onSubmitEditing={() => (name === 'fiber' ? void submit(intentLogs.current) : focusNext(name))}
      returnKeyType={name === 'fiber' ? 'done' : 'next'}
      {...extra}
    />
  );
  const numeric = (name: CustomFoodField, label: string, suffix: string) =>
    field(name, label, { suffix, keyboardType: 'decimal-pad', selectTextOnFocus: true });

  const finish = async (food: Food, logIt: boolean) => {
    if (!logIt) {
      // Leave through the effect so prevention has dropped (created is set) before going back.
      setLeaving(true);
      return;
    }
    await createEntry({
      foodId: food.id,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      quantity: 1,
      mealLabel: mealForHour(new Date().getHours()),
    });
    await queryClient.invalidateQueries({ queryKey: trackingKeys.all });
    hapticLight();
    router.dismissAll();
  };

  const submit = async (logIt: boolean) => {
    if (sending.current) return;
    intentLogs.current = logIt;
    scroll.current?.scrollTo({ y: 0, animated: true });
    setTouched(Object.fromEntries(FIELDS.map((f) => [f, 'yes'])));
    const { body } = validateForm(values);
    if (!createdRef.current && !body) return;
    sending.current = true;
    setBusy(true);
    setProblem(null);
    try {
      if (editing) {
        const saved = await updateCustomFood(id as string, body as CustomFoodBody);
        queryClient.setQueryData(foodKeys.detail(saved.id), saved);
        void queryClient.invalidateQueries({ queryKey: foodKeys.custom });
        setLeaving(true);
        return;
      }
      const food = createdRef.current ?? (await createCustomFood(body as CustomFoodBody));
      if (!createdRef.current) {
        createdRef.current = food;
        setCreated(food);
        void queryClient.invalidateQueries({ queryKey: foodKeys.custom });
      }
      await finish(food, logIt);
    } catch (e) {
      if (e instanceof NetworkError) setProblem({ kind: 'offline', message: OFFLINE });
      else if (editing && e instanceof ApiError && e.status === 404) setProblem({ kind: 'gone', message: GONE });
      else if (createdRef.current) setProblem({ kind: 'log', message: LOG_FAILED });
      else {
        const mapped = mapFieldErrors(e, FIELDS);
        setServerErrors(mapped.errors);
        const is400 = e instanceof ApiError && e.status === 400;
        const matched = Object.keys(mapped.errors).length > 0;
        if (is400 && matched && !mapped.hasUnmatched) setProblem(null);
        else setProblem({ kind: 'generic', message: is400 ? 'Check the details and try again.' : GENERIC });
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const back = () => router.back();
  const hint = macroHint(values);
  const missing = source.error instanceof ApiError && source.error.status === 404;
  const gate = editing && !loaded;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
      </Pressable>
      {gate ? (
        source.isError ? (
          <StateBlock
            variant="error"
            title={missing ? GONE_TITLE : source.error instanceof NetworkError ? "You're offline" : "Couldn't load this food"}
            message={missing ? 'It may have been deleted. Go back to My Foods.' : 'Check your connection and try again.'}
            actionLabel={missing ? 'Back to My Foods' : 'Retry'}
            onAction={missing ? () => router.back() : () => void source.refetch()}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator accessibilityLabel="Loading food" color={colors.accent} />
          </View>
        )
      ) : (
      <KeyboardAvoider>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {editing ? 'Edit food' : createOnly ? 'New food' : 'Enter a food'}
          </Text>
          {problem ? (
            <Banner
              variant={problem.kind === 'offline' ? 'caution' : 'danger'}
              message={problem.message}
              action={problem.kind === 'gone' ? undefined : { label: 'Retry', onPress: () => void submit(intentLogs.current) }}
            />
          ) : null}
          {field('name', 'Name', { autoFocus: !editing, autoCapitalize: 'sentences' })}
          {field('brand', 'Brand (optional)', { autoCapitalize: 'words' })}
          {numeric('servingSize', 'Serving size', '')}
          <UnitPicker
            label="Unit"
            value={values.servingUnit as ServingUnit}
            onChange={(u) => setValues((v) => ({ ...v, servingUnit: u }))}
            disabled={busy || !!created}
          />
          <View style={styles.row}>
            <View style={styles.cell}>{numeric('calories', 'Calories', 'kcal')}</View>
            <View style={styles.cell}>{numeric('protein', 'Protein', 'g')}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>{numeric('carbs', 'Carbs', 'g')}</View>
            <View style={styles.cell}>{numeric('fat', 'Fat', 'g')}</View>
          </View>
          {hint ? (
            <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
              {hint}
            </Text>
          ) : null}
          {numeric('fiber', 'Fiber (optional)', 'g')}
        </ScrollView>
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: space.lg + (keyboardUp ? 0 : insets.bottom) },
          ]}
        >
          {editing ? (
            <Button label="Save changes" onPress={() => void submit(false)} loading={busy} />
          ) : createOnly ? (
            <Button label="Save food" onPress={() => void submit(false)} loading={busy} />
          ) : (
            <>
              <Button label="Log food" onPress={() => void submit(true)} loading={busy} />
              {created ? null : (
                <Button variant="text" size="md" label="Save to My Foods only" onPress={() => void submit(false)} disabled={busy} />
              )}
            </>
          )}
        </View>
      </KeyboardAvoider>
      )}
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this food?"
        message="What you typed won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          setLeaving(true);
        }}
        onCancel={() => {
          leaveRepeat.current = null;
          setConfirmDiscard(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { width: sizing.touchMin, height: sizing.touchMin, marginLeft: space.sm, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1 },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: sizing.border },
});
