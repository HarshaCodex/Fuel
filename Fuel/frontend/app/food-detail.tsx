import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFood, type Food } from '@/api/food';
import { createEntry, trackingKeys, type FoodSource, type MealLabel } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StateBlock } from '@/components/StateBlock';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { TrustBadge } from '@/components/TrustBadge';
import { formatGrams, formatKcal } from '@/lib/dashboardView';
import { hapticLight } from '@/lib/haptics';
import { MEAL_OPTIONS, mealForHour } from '@/lib/mealLabel';
import { MAX_QUANTITY, amountError, parseAmount, portionMacros } from '@/lib/portion';
import { radius, sizing, space, type, useTheme } from '@/theme';

const FOOD_STALE_MS = 60_000;
const SOURCE_LINES: Record<FoodSource, string> = {
  USDA: 'From USDA FoodData Central',
  OFF: 'From the manufacturer label',
  USER: 'Entered by you',
};

function logErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return "You're offline. Check your connection and try again.";
  if (error instanceof ApiError) {
    if (error.status === 404) return 'That food is no longer available';
    if (error.status === 400) return error.message;
  }
  return "Couldn't log this food. Try again.";
}

function Macro({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.macro} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {value}
      </Text>
      <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
    </View>
  );
}

function Confirm({ food }: { food: Food }) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState(formatGrams(food.servingSize).replace(/,/g, ''));
  const [quantity, setQuantity] = useState(1);
  const [meal, setMeal] = useState<MealLabel>(() => mealForHour(new Date().getHours()));
  const [touched, setTouched] = useState(false);
  const sending = useRef(false);

  const amount = parseAmount(amountText);
  const fieldError = touched ? amountError(amountText) : null;
  const macros = portionMacros(food, amount ?? food.servingSize, quantity);

  const log = useMutation({
    mutationFn: createEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trackingKeys.all });
      hapticLight();
      router.dismissAll();
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const submit = () => {
    setTouched(true);
    if (amount === null || sending.current) return;
    sending.current = true;
    log.mutate({ foodId: food.id, servingSize: amount, servingUnit: food.servingUnit, quantity, mealLabel: meal });
  };

  return (
    <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} numberOfLines={3} maxFontSizeMultiplier={2}>
          {food.name}
        </Text>
        {food.brand ? (
          <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {food.brand}
          </Text>
        ) : null}
        <View style={styles.trust}>
          <TrustBadge source={food.source} />
          <Text style={[type.callout, styles.source, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
            {SOURCE_LINES[food.source]}
          </Text>
        </View>

        {log.isError ? (
          <Banner variant="caution" message={logErrorMessage(log.error)} action={{ label: 'Retry', onPress: submit }} />
        ) : null}

        <View>
            <TextField
              label="Amount"
              suffix={food.servingUnit}
              value={amountText}
              onChangeText={setAmountText}
              onBlur={() => setTouched(true)}
              keyboardType="decimal-pad"
              error={fieldError}
              editable={!log.isPending}
              returnKeyType="done"
            />
        </View>

        <Stepper
          label="Quantity"
          value={quantity}
          min={0.5}
          max={MAX_QUANTITY}
          step={0.5}
          onChange={setQuantity}
          disabled={log.isPending}
          format={(v) => `${v}`}
        />

        <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} disabled={log.isPending} />

        <View
          accessible
          accessibilityLabel={`${formatKcal(macros.calories)} calories, protein ${formatGrams(macros.protein)} grams, carbs ${formatGrams(macros.carbs)} grams, fat ${formatGrams(macros.fat)} grams`}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[type.display, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {formatKcal(macros.calories)} kcal
          </Text>
          <View style={styles.macros}>
            <Macro label="Protein" value={`${formatGrams(macros.protein)} g`} />
            <Macro label="Carbs" value={`${formatGrams(macros.carbs)} g`} />
            <Macro label="Fat" value={`${formatGrams(macros.fat)} g`} />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Button
          label={`Log ${formatKcal(macros.calories)} kcal`}
          onPress={submit}
          loading={log.isPending}
          disabled={amount === null}
        />
      </View>
    </KeyboardAvoider>
  );
}

export default function FoodDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const food = useQuery({ queryKey: foodKeys.detail(id), queryFn: () => getFood(id), staleTime: FOOD_STALE_MS, enabled: !!id });

  let body;
  if (food.data) body = <Confirm food={food.data} />;
  else if (food.isError) {
    const gone = food.error instanceof ApiError && food.error.status === 404;
    body = gone ? (
      <StateBlock
        variant="empty"
        title="Food not found"
        message="That food is no longer available."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    ) : (
      <StateBlock
        variant="error"
        title={food.error instanceof NetworkError ? "You're offline" : "Couldn't load this food"}
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void food.refetch()}
      />
    );
  } else {
    body = (
      <View style={styles.center} accessible accessibilityLabel="Loading food">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
      </Pressable>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { width: sizing.touchMin, height: sizing.touchMin, marginLeft: space.sm, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  trust: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  source: { flexShrink: 1 },
  card: { borderRadius: radius.md, borderWidth: sizing.border, padding: space.lg, gap: space.md },
  macros: { flexDirection: 'row', justifyContent: 'space-between' },
  macro: { alignItems: 'flex-start', gap: space.xs },
  footer: { padding: space.lg, borderTopWidth: sizing.border },
});
