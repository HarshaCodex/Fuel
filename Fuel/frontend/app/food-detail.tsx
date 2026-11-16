import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, NetworkError } from '@/api/errors';
import { foodKeys, getFood, type Food } from '@/api/food';
import { createEntry, trackingKeys, type FoodSource, type MealLabel } from '@/api/tracking';
import { AmountPill } from '@/components/AmountPill';
import { Banner } from '@/components/Banner';
import { CalorieCard } from '@/components/CalorieCard';
import { useCardStyle } from '@/components/cardStyle';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { LogFade } from '@/components/LogFade';
import { MealPills } from '@/components/MealPills';
import { PortionTiles, type PortionChoice } from '@/components/PortionTiles';
import { PressableScale } from '@/components/PressableScale';
import { StateBlock } from '@/components/StateBlock';
import { formatKcal } from '@/lib/dashboardView';
import { hapticLight } from '@/lib/haptics';
import { logErrorMessage } from '@/lib/logError';
import { mealForHour } from '@/lib/mealLabel';
import { amountError, formatPortionAmount, parseAmount, portionMacros, portionTiles } from '@/lib/portion';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

const FOOD_STALE_MS = 60_000;
const SOURCE_ICON = 16;
const MEAL_NAMES: Record<MealLabel, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const SOURCE_LINES: Record<FoodSource, string> = {
  USDA: 'Verified · USDA FoodData Central',
  OFF: 'From the manufacturer label',
  USER: 'Entered by you',
};

function Confirm({ food }: { food: Food }) {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<PortionChoice>('one');
  const [customText, setCustomText] = useState('');
  const [meal, setMeal] = useState<MealLabel>(() => mealForHour(new Date().getHours()));
  const [touched, setTouched] = useState(false);
  const sending = useRef(false);

  const tiles = portionTiles(food);
  const custom = choice === 'custom';
  const tileAmount = tiles.find((t) => t.key === choice)?.amount ?? food.servingSize;
  const amount = custom ? parseAmount(customText) : tileAmount;
  const fieldError = custom && touched ? amountError(customText) : null;
  const shown = amount ?? food.servingSize;
  const macros = portionMacros(food, shown, 1);

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

  const select = (next: PortionChoice) => {
    // Custom starts from the amount that was showing, as a plain decimal.
    if (next === 'custom') setCustomText(String(shown));
    setTouched(false);
    setChoice(next);
  };

  const submit = () => {
    setTouched(true);
    if (amount === null || sending.current) return;
    sending.current = true;
    log.mutate({ foodId: food.id, servingSize: amount, servingUnit: food.servingUnit, quantity: 1, mealLabel: meal });
  };

  const label = `Log ${formatKcal(macros.calories)} kcal to ${MEAL_NAMES[meal]}`;
  const disabled = amount === null;
  const ctaShadow = scheme === 'dark' ? null : { ...shadow.lg, shadowColor: colors.accent, shadowOpacity: 0.28 };

  return (
    <KeyboardAvoider avoidOnAndroid>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {log.isError ? (
          <Banner variant="caution" message={logErrorMessage(log.error)} action={{ label: 'Retry', onPress: submit }} />
        ) : null}
        <PortionTiles food={food} selected={choice} onSelect={select} />
        {custom ? (
          <AmountPill
            value={customText}
            onChangeText={setCustomText}
            unit={food.servingUnit}
            error={fieldError}
            onBlur={() => setTouched(true)}
          />
        ) : null}
        <CalorieCard macros={macros} amountLabel={formatPortionAmount(shown, food.servingUnit)} />
        <MealPills selected={meal} onSelect={setMeal} />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <LogFade />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: disabled || log.isPending, busy: log.isPending }}
          disabled={disabled || log.isPending}
          onPress={submit}
          style={ctaShadow}
          contentStyle={[styles.cta, { backgroundColor: disabled ? colors.surfaceMuted : colors.accent }]}
        >
          {log.isPending ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text
              style={[type.headline, { color: disabled ? colors.textTertiary : colors.onAccent }]}
              maxFontSizeMultiplier={2}
            >
              {label}
            </Text>
          )}
        </PressableScale>
      </View>
    </KeyboardAvoider>
  );
}

function TitleBlock({ food }: { food: Food }) {
  const { colors } = useTheme();
  return (
    <View style={styles.title}>
      <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} numberOfLines={3} maxFontSizeMultiplier={2}>
        {food.name}
      </Text>
      {food.brand ? (
        <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {food.brand}
        </Text>
      ) : null}
      <View style={styles.source}>
        {food.source === 'USDA' ? (
          <Ionicons name="checkmark-circle" size={SOURCE_ICON} color={colors.verified} accessible={false} />
        ) : null}
        <Text
          style={[type.callout, { color: food.source === 'USDA' ? colors.verified : colors.textSecondary }]}
          maxFontSizeMultiplier={2}
        >
          {SOURCE_LINES[food.source]}
        </Text>
      </View>
    </View>
  );
}

export default function FoodDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const card = useCardStyle();
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
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.back}
        contentStyle={[styles.backFace, card]}
      >
        <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
      </PressableScale>
      {food.data ? <TitleBlock food={food.data} /> : null}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: space.lg, alignSelf: 'flex-start' },
  backFace: { width: sizing.touchMin, height: sizing.touchMin, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
  source: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  content: { padding: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg },
  cta: { height: sizing.cta, borderRadius: radius.sheet, alignItems: 'center', justifyContent: 'center' },
});
