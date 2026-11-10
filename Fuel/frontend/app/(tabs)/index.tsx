import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError, NetworkError } from '@/api/errors';
import {
  getDashboard,
  trackingKeys,
  updateEntry,
  type CreatedEntry,
  type Dashboard,
  type DashboardEntry,
  type UpdateEntryBody,
} from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { CalorieRing } from '@/components/CalorieRing';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { EditEntrySheet } from '@/components/EditEntrySheet';
import { MacroPills } from '@/components/MacroPills';
import { MealList } from '@/components/MealList';
import { StateBlock } from '@/components/StateBlock';
import { StreakChip } from '@/components/StreakChip';
import { UndoToast } from '@/components/UndoToast';
import { editFactor, withEditedEntry, withoutEntries } from '@/lib/dashboardTotals';
import { addDays, dateTitle, isFutureDate } from '@/lib/dashboardView';
import { usePendingDeletes } from '@/lib/usePendingDeletes';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

function DateButton({ icon, label, disabled, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={styles.dateButton}
    >
      <Ionicons name={icon} size={sizing.icon} color={disabled ? colors.textTertiary : colors.text} />
    </Pressable>
  );
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  // null means "today as the server sees it": the request omits the date and the response says which day that is.
  const [selected, setSelected] = useState<string | null>(null);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isToday = selected === null;
  const date = selected ?? undefined;
  const q = useQuery({
    queryKey: trackingKeys.dashboard(date),
    queryFn: () => getDashboard(date),
  });
  const todayFromServer = isToday ? q.data?.date : undefined;
  // Remember the server's today so it survives while another day is selected (state adjusted during render).
  if (todayFromServer && todayFromServer !== serverToday) setServerToday(todayFromServer);
  const today = todayFromServer ?? serverToday;
  const goTo = (target: string) => setSelected(target === today ? null : target);
  const qc = useQueryClient();
  const dashKey = trackingKeys.dashboard(date);
  const [editing, setEditing] = useState<DashboardEntry | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Optimistic: totals and the row change at once from the linear estimate; on failure the snapshot comes back.
  const edit = useMutation({
    mutationFn: ({ current, body }: { current: CreatedEntry; body: UpdateEntryBody }) => updateEntry(current.id, body),
    onMutate: async ({ current, body }) => {
      await qc.cancelQueries({ queryKey: trackingKeys.all });
      const snapshot = qc.getQueryData<Dashboard>(dashKey);
      const factor = editFactor(
        { amount: current.servingSize, quantity: current.quantity },
        { amount: body.servingSize ?? current.servingSize, quantity: body.quantity ?? current.quantity },
      );
      qc.setQueryData<Dashboard>(dashKey, (d) => (d ? withEditedEntry(d, current.id, { factor, mealLabel: body.mealLabel }) : d));
      return { snapshot };
    },
    onError: (error, { current }, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(dashKey, ctx.snapshot);
      setEditError(
        error instanceof NetworkError
          ? `You're offline. ${current.foodName} wasn't changed.`
          : error instanceof ApiError && error.status === 404
            ? 'That entry no longer exists'
            : error instanceof ApiError && error.status === 400
              ? error.message
              : `Couldn't save ${current.foodName}. Try again.`,
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: trackingKeys.all }),
  });
  const onEditEntry = (entry: DashboardEntry) => {
    setEditError(null);
    setEditing(entry);
  };
  const onSaveEdit = (current: CreatedEntry, body: UpdateEntryBody) => {
    setEditing(null);
    edit.mutate({ current, body });
  };
  const onMissing = useCallback(() => {
    setEditing(null);
    setEditError('That entry no longer exists');
    void qc.invalidateQueries({ queryKey: trackingKeys.all });
  }, [qc]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const pending = usePendingDeletes((error, entry) =>
    setDeleteError(
      error instanceof NetworkError
        ? `You're offline. ${entry.foodName} wasn't deleted.`
        : error instanceof ApiError && error.status === 404
          ? `${entry.foodName} was already removed.`
          : `Couldn't delete ${entry.foodName}. Try again.`,
    ),
  );
  // The deleted rows are hidden by id, not removed from the cache, so a refetch or a failure never loses a row.
  const data = useMemo(() => (q.data ? withoutEntries(q.data, pending.ids) : undefined), [q.data, pending.ids]);
  const onDeleteEntry = (entry: DashboardEntry) => {
    setDeleteError(null);
    pending.schedule(entry);
  };
  const offline = q.error instanceof NetworkError;
  const retry = () => void q.refetch();
  const logFood = () => router.push('/quick-log');

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        testID="today-scroll"
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.header}>
          <DateButton
            icon="chevron-back"
            label="Previous day"
            disabled={!today}
            onPress={() => today && goTo(addDays(selected ?? today, -1))}
          />
          <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {selected && today ? dateTitle(selected, today) : 'Today'}
          </Text>
          <DateButton
            icon="chevron-forward"
            label="Next day"
            disabled={!today || isToday || isFutureDate(addDays(selected, 1), today)}
            onPress={() => today && selected && goTo(addDays(selected, 1))}
          />
        </View>

        {data ? <StreakChip current={data.streak.current} /> : null}

        {q.isError && data ? (
          <Banner
            variant="caution"
            message={offline ? "You're offline. Showing the last data we have." : "Couldn't refresh. Showing the last data we have."}
            action={{ label: 'Retry', onPress: retry }}
          />
        ) : null}

        {deleteError ? <Banner variant="caution" message={deleteError} /> : null}
        {editError ? <Banner variant="caution" message={editError} /> : null}

        {q.isPending ? <DashboardSkeleton /> : null}

        {q.isError && !data ? (
          <StateBlock
            variant="error"
            title={offline ? "You're offline" : "Couldn't load your day"}
            message={offline ? 'Check your connection and try again.' : 'Something went wrong on our side. Try again.'}
            actionLabel="Retry"
            onAction={retry}
          />
        ) : null}

        {data ? (
          <>
            <View style={[styles.ringCard, shadow.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <CalorieRing consumed={data.calories.consumed} goal={data.calories.goal} />
            </View>
            <MacroPills protein={data.macros.protein} carbs={data.macros.carbs} fat={data.macros.fat} />
            <View style={styles.meals}>
              <Text accessibilityRole="header" style={[type.title2, { color: colors.text }]} maxFontSizeMultiplier={2}>
                Meals
              </Text>
              {data.entries.length === 0 ? (
                <StateBlock
                  variant="empty"
                  title="Nothing logged yet"
                  message="Log your first food to see how the day is going."
                  actionLabel="Log your first food"
                  onAction={logFood}
                />
              ) : (
                <MealList entries={data.entries} onDeleteEntry={onDeleteEntry} onEditEntry={onEditEntry} />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
      <EditEntrySheet
        entry={editing}
        date={date}
        onClose={() => setEditing(null)}
        onMissing={onMissing}
        onSave={onSaveEdit}
      />
      {pending.last ? (
        <UndoToast message={`${pending.last.foodName} deleted`} actionLabel="Undo" onAction={pending.undo} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log food"
        onPress={logFood}
        style={({ pressed }) => [
          styles.fab,
          shadow.lg,
          { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingTop: space.xxxl, paddingBottom: sizing.fab + space.xxxl, gap: space.md },
  meals: { gap: space.sm, marginTop: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateButton: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  ringCard: { alignItems: 'center', padding: space.xl, borderRadius: radius.lg, borderWidth: 1 },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: sizing.fab,
    height: sizing.fab,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
