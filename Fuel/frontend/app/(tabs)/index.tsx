import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NetworkError } from '@/api/errors';
import { getDashboard, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { CalorieRing } from '@/components/CalorieRing';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MacroPills } from '@/components/MacroPills';
import { MealList } from '@/components/MealList';
import { StateBlock } from '@/components/StateBlock';
import { StreakChip } from '@/components/StreakChip';
import { addDays, dateTitle, isFutureDate, isoDate } from '@/lib/dashboardView';
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
  const todayIso = isoDate(new Date());
  const [date, setDate] = useState(todayIso);
  const [refreshing, setRefreshing] = useState(false);
  const isToday = date === todayIso;
  const q = useQuery({
    queryKey: trackingKeys.dashboard(isToday ? undefined : date),
    queryFn: () => getDashboard(isToday ? undefined : date),
  });
  const data = q.data;
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
          <DateButton icon="chevron-back" label="Previous day" onPress={() => setDate(addDays(date, -1))} />
          <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
            {dateTitle(date, todayIso)}
          </Text>
          <DateButton
            icon="chevron-forward"
            label="Next day"
            disabled={isFutureDate(addDays(date, 1), todayIso)}
            onPress={() => setDate(addDays(date, 1))}
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
                <MealList entries={data.entries} />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
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
