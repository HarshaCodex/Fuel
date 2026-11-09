import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '@/api/errors';
import { createCustomFood, foodKeys, type CustomFoodBody, type Food, type ServingUnit } from '@/api/food';
import { createEntry, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/TextField';
import { UnitPicker } from '@/components/UnitPicker';
import {
  EMPTY_FORM,
  FIELDS,
  fieldError,
  isDirty,
  macroHint,
  validateForm,
  type CustomFoodField,
  type FormValues,
} from '@/lib/customFoodForm';
import { mapFieldErrors } from '@/lib/fieldErrors';
import { mealForHour } from '@/lib/mealLabel';
import { sizing, space, type, useTheme } from '@/theme';

type Input = ComponentRef<typeof TextInput>;
type Fields = Partial<Record<CustomFoodField, string>>;
type Problem = { kind: 'offline' | 'generic' | 'log'; message: string };

const OFFLINE = "You're offline. Check your connection and try again.";
const GENERIC = "Couldn't save this food. Try again.";
const LOG_FAILED = "Saved to My Foods, but couldn't log it. Try again.";

export default function ManualEntryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const createOnly = mode === 'create';

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState<Fields>({});
  const [serverErrors, setServerErrors] = useState<Fields>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [created, setCreated] = useState<Food | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const sending = useRef(false);
  const intentLogs = useRef(!createOnly);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const createdRef = useRef<Food | null>(null);
  const inputs = useRef<Partial<Record<CustomFoodField, Input | null>>>({});

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
      router.back();
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
      const food = createdRef.current ?? (await createCustomFood(body as CustomFoodBody));
      if (!createdRef.current) {
        createdRef.current = food;
        setCreated(food);
        void queryClient.invalidateQueries({ queryKey: foodKeys.custom });
      }
      await finish(food, logIt);
    } catch (e) {
      if (e instanceof NetworkError) setProblem({ kind: 'offline', message: OFFLINE });
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

  const back = () => (isDirty(values) && !created ? setConfirmDiscard(true) : router.back());
  const hint = macroHint(values);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
        <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
      </Pressable>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {createOnly ? 'New food' : 'Enter a food'}
          </Text>
          {problem ? (
            <Banner
              variant={problem.kind === 'offline' ? 'caution' : 'danger'}
              message={problem.message}
              action={{ label: 'Retry', onPress: () => void submit(intentLogs.current) }}
            />
          ) : null}
          {field('name', 'Name', { autoFocus: true, autoCapitalize: 'sentences' })}
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
          {createOnly ? (
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
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this food?"
        message="What you typed won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          router.back();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { width: sizing.touchMin, height: sizing.touchMin, marginLeft: space.sm, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1 },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: sizing.border },
});
