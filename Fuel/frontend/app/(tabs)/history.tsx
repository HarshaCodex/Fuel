import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NetworkError } from '@/api/errors';
import { getHistory, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { HistoryChart } from '@/components/HistoryChart';
import { HistoryDayRow } from '@/components/HistoryDayRow';
import { HistorySummary } from '@/components/HistorySummary';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StateBlock } from '@/components/StateBlock';
import { isoDate } from '@/lib/dashboardView';
import { chartBars, rangeFor, summary } from '@/lib/historyView';
import { radius, sizing, space, type, useTheme } from '@/theme';

type RangeKey = '7' | '30' | '90';
const OPTIONS = [
  { value: '7' as RangeKey, label: '7 days' },
  { value: '30' as RangeKey, label: '30 days' },
  { value: '90' as RangeKey, label: '90 days' },
];
const SKELETON_ROWS = [0, 1, 2];
const SKELETON_CHART = 160;
const SKELETON_ROW = 72;

function HistorySkeleton() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading your history" accessibilityRole="progressbar" style={styles.skeleton}>
      <View style={[styles.skeletonChart, { backgroundColor: colors.surfaceMuted }]} />
      {SKELETON_ROWS.map((i) => (
        <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surfaceMuted }]} />
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [rangeKey, setRangeKey] = useState<RangeKey>('7');
  const [refreshing, setRefreshing] = useState(false);
  // Recomputed on every render so a screen left open past midnight moves its window on the next refresh.
  const todayIso = isoDate(new Date());
  const range = rangeFor(Number(rangeKey), todayIso);
  const q = useQuery({
    queryKey: trackingKeys.history(range.from, range.to),
    queryFn: () => getHistory(range.from, range.to),
    placeholderData: keepPreviousData,
  });
  const days = q.data;
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
  const openDay = (date: string) => router.push({ pathname: '/day', params: { date } });
  const goal = days?.[0]?.calorieGoal ?? 0;

  let body;
  if (q.isPending) {
    body = <HistorySkeleton />;
  } else if (q.isError && !days) {
    body = (
      <StateBlock
        variant="error"
        title={offline ? "You're offline" : "Couldn't load your history"}
        message={offline ? 'Check your connection and try again.' : 'Something went wrong on our side. Try again.'}
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (days && days.length === 0) {
    body = (
      <StateBlock
        variant="empty"
        title="Your history starts with your first log"
        message="Log a meal and your days will show up here."
        actionLabel="Go to Today"
        onAction={() => router.navigate('/')}
      />
    );
  } else if (days) {
    body = (
      <>
        <HistorySummary {...summary(days)} />
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <HistoryChart bars={chartBars(days, range, todayIso)} goal={goal} />
        </View>
        <View style={styles.rows}>
          {days.map((day) => (
            <HistoryDayRow key={day.date} day={day} onPress={openDay} />
          ))}
        </View>
      </>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView
        testID="history-scroll"
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
          History
        </Text>
        <SegmentedControl label="Range" options={OPTIONS} value={rangeKey} onChange={setRangeKey} />
        {q.isError && days ? (
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
  content: { padding: space.lg, paddingTop: space.xxxl, paddingBottom: space.xxxl, gap: space.md },
  chartCard: { padding: space.md, borderRadius: radius.lg, borderWidth: sizing.border },
  rows: { gap: space.sm },
  skeleton: { gap: space.md },
  skeletonChart: { height: SKELETON_CHART, borderRadius: radius.lg },
  skeletonRow: { height: SKELETON_ROW, borderRadius: radius.md },
});
