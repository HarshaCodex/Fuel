import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NetworkError } from '@/api/errors';
import { getEntries, trackingKeys, type CreatedEntry, type DashboardEntry, type MealLabel, type UpdateEntryBody } from '@/api/tracking';
import { MEAL_OPTIONS } from '@/lib/mealLabel';
import { MAX_QUANTITY, amountError, parseAmount } from '@/lib/portion';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';
import { StateBlock } from './StateBlock';
import { Stepper } from './Stepper';
import { TextField } from './TextField';

type Props = {
  /** The row being edited; the sheet is closed when null. */
  entry: DashboardEntry | null;
  /** The day shown on Today (undefined for today), used to fetch the entry's amount and quantity. */
  date?: string;
  onClose: () => void;
  /** The id is no longer in the day's list. */
  onMissing: () => void;
  /** Only the changed fields are in `body`. */
  onSave: (current: CreatedEntry, body: UpdateEntryBody) => void;
};

const isMeal = (v: string | null): v is MealLabel => MEAL_OPTIONS.some((o) => o.value === v);

function Form({ current, onClose, onSave }: { current: CreatedEntry; onClose: () => void; onSave: Props['onSave'] }) {
  const { colors } = useTheme();
  const [amountText, setAmountText] = useState(String(current.servingSize));
  const [quantity, setQuantity] = useState(current.quantity);
  const initialMeal = isMeal(current.mealLabel) ? current.mealLabel : null;
  const [meal, setMeal] = useState<MealLabel | null>(initialMeal);
  const [touched, setTouched] = useState(false);

  const amount = parseAmount(amountText);
  const body: UpdateEntryBody = {};
  if (amount !== null && amount !== current.servingSize) body.servingSize = amount;
  if (quantity !== current.quantity) body.quantity = quantity;
  if (meal !== null && meal !== initialMeal) body.mealLabel = meal;
  const changed = Object.keys(body).length > 0;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[type.title2, { color: colors.text }]} numberOfLines={2} maxFontSizeMultiplier={2}>
          Edit {current.foodName}
        </Text>
        <TextField
          label="Amount"
          suffix={current.servingUnit}
          value={amountText}
          onChangeText={setAmountText}
          onBlur={() => setTouched(true)}
          keyboardType="decimal-pad"
          error={touched ? amountError(amountText) : null}
          returnKeyType="done"
        />
        <Stepper label="Quantity" value={quantity} min={0.5} max={MAX_QUANTITY} step={0.5} onChange={setQuantity} format={(v) => `${v}`} />
        <SegmentedControl label="Meal" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Save" onPress={() => onSave(current, body)} disabled={!changed || amount === null} />
        <Button label="Cancel" variant="text" onPress={onClose} />
      </View>
    </>
  );
}

/** Bottom sheet to change the amount, quantity and meal of a logged entry. Loads the full entry when it opens. */
export function EditEntrySheet({ entry, date, onClose, onMissing, onSave }: Props) {
  const { colors } = useTheme();
  // Cached rows from an earlier open are untrusted until the refetch lands, so the form never prefills
  // from them. Focus/reconnect refetches are off so a refetch cannot remount the form mid-edit.
  const list = useQuery({
    queryKey: trackingKeys.entries(date),
    queryFn: () => getEntries(date),
    enabled: entry !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const current = entry && list.data ? list.data.find((e) => e.id === entry.id) : undefined;
  const missing = entry !== null && !!list.data && !current && !list.isFetching;
  useEffect(() => {
    if (missing) onMissing();
  }, [missing, onMissing]);

  let body;
  if (current && !list.isFetching) body = <Form key={current.id} current={current} onClose={onClose} onSave={onSave} />;
  else if (list.isError) {
    body = (
      <View>
        <StateBlock
          variant="error"
          title={list.error instanceof NetworkError ? "You're offline" : "Couldn't load this entry"}
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void list.refetch()}
        />
        <Button label="Cancel" variant="text" onPress={onClose} />
      </View>
    );
  } else {
    body = (
      <View style={styles.loading} accessible accessibilityLabel="Loading entry">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Modal visible={entry !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Close edit" onPress={onClose} style={[styles.scrim, { backgroundColor: colors.scrim }]} />
        <View accessibilityViewIsModal style={[styles.sheet, shadow.lg, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {body}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: sizing.border, maxHeight: '90%', paddingBottom: space.lg },
  content: { padding: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, gap: space.sm },
  loading: { padding: space.xxxl, alignItems: 'center' },
});
