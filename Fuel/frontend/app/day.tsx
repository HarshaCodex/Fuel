import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { NetworkError } from '@/api/errors';
import { getDashboard, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { CalorieRing } from '@/components/CalorieRing';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { MacroPills } from '@/components/MacroPills';
import { MealList } from '@/components/MealList';
import { StateBlock } from '@/components/StateBlock';
import { dateTitle, isoDate } from '@/lib/dashboardView';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, not just a string of the right shape. The value goes into a request URL. */
function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

/** One past day, read-only: the dashboard components without streak, edit or delete. */
export default function DayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = isValidDate(params.date) ? params.date : null;
  const todayIso = isoDate(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const q = useQuery({
    queryKey: trackingKeys.dashboard(date ?? undefined),
    queryFn: () => getDashboard(date ?? undefined),
    enabled: date !== null,
  });
  const data = q.data;
  const offline = q.error instanceof NetworkError;
  const retry = () => void q.refetch();
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  let body;
  if (date === null) {
    body = (
      <StateBlock
        variant="error"
        title="We can't open that day"
        message="The date isn't valid. Go back and pick a day from History."
        actionLabel="Back to History"
        onAction={() => router.back()}
      />
    );
  } else if (q.isPending) {
    body = <DashboardSkeleton />;
  } else if (q.isError && !data) {
    body = (
      <StateBlock
        variant="error"
        title={offline ? "You're offline" : "Couldn't load this day"}
        message={offline ? 'Check your connection and try again.' : 'Something went wrong on our side. Try again.'}
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (data) {
    body = (
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
            <Text style={[type.body, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
              No entries
            </Text>
          ) : (
            <MealList entries={data.entries} />
          )}
        </View>
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[type.title1, styles.title, { color: colors.text }]} maxFontSizeMultiplier={2}>
          {date ? dateTitle(date, todayIso) : 'Day'}
        </Text>
      </View>
      <ScrollView
        testID="day-scroll"
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={date ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}
      >
        {q.isError && data ? (
          <Banner
            variant="caution"
            message={offline ? "You're offline. Showing the last data we have." : "Couldn't refresh. Showing the last data we have."}
            action={{ label: 'Retry', onPress: retry }}
          />
        ) : null}
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  back: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },
  meals: { gap: space.sm, marginTop: space.md },
  ringCard: { alignItems: 'center', padding: space.xl, borderRadius: radius.lg, borderWidth: 1 },
});
