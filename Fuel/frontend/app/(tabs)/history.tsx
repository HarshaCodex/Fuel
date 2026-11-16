import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NetworkError } from '@/api/errors';
import { getDashboard, getHistory, trackingKeys } from '@/api/tracking';
import { Banner } from '@/components/Banner';
import { HistorySummaryLine } from '@/components/HistorySummaryLine';
import { MonthCalendar } from '@/components/MonthCalendar';
import { PressableScale } from '@/components/PressableScale';
import { SelectedDayCard } from '@/components/SelectedDayCard';
import { StateBlock } from '@/components/StateBlock';
import { isoDate } from '@/lib/dashboardView';
import { hapticSelect } from '@/lib/haptics';
import { defaultSelection, monthRange, shiftMonth, summary, type YearMonth } from '@/lib/historyView';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { shadow, space, type, useTheme } from '@/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const STALE_MS = 5 * 60 * 1000;
const SLIDE = 24;
const SLIDE_MS = 220;
const BUTTON = 44;

/** Fades (and slides, unless Reduce Motion is on) its children in whenever `k` changes. */
function Swap({ k, dir, slide, children }: { k: string; dir: number; slide: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: reduce ? 0 : SLIDE_MS, useNativeDriver: true }).start();
  }, [k, v, reduce]);
  const x = slide && !reduce ? v.interpolate({ inputRange: [0, 1], outputRange: [dir * SLIDE, 0] }) : 0;
  return <Animated.View style={{ opacity: v, transform: [{ translateX: x }] }}>{children}</Animated.View>;
}

type ArrowProps = { icon: 'chevron-back' | 'chevron-forward'; label: string; disabled?: boolean; onPress: () => void };

function Arrow({ icon, label, disabled, onPress }: ArrowProps) {
  const { colors, scheme } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.arrow,
        { backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 },
        scheme === 'dark' ? { borderWidth: 1, borderColor: colors.border } : shadow.sm,
      ]}
      contentStyle={styles.arrowInner}
    >
      <Ionicons name={icon} size={20} color={colors.text} accessibilityElementsHidden importantForAccessibility="no" />
    </PressableScale>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  // Recomputed on every render so a screen left open past midnight moves on at the next change.
  const todayIso = isoDate(new Date());
  const [shown, setShown] = useState<YearMonth>(() => ({ year: Number(todayIso.slice(0, 4)), month: Number(todayIso.slice(5, 7)) }));
  const [picked, setPicked] = useState<string | null>(null);
  const [dir, setDir] = useState(1);
  const range = monthRange(shown.year, shown.month, todayIso);
  const q = useQuery({
    queryKey: trackingKeys.history(range.from, range.to),
    queryFn: () => getHistory(range.from, range.to),
    staleTime: STALE_MS,
  });
  const dash = useQuery({ queryKey: trackingKeys.dashboard(), queryFn: () => getDashboard(), staleTime: STALE_MS });
  const rows = q.data ?? [];
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
  const isCurrent = range.to === todayIso;
  const move = (delta: number) => {
    setShown((s) => shiftMonth(s, delta, todayIso));
    setPicked(null);
    setDir(delta);
  };
  const selected = picked ?? defaultSelection(shown, rows, todayIso);
  const monthKey = `${shown.year}-${shown.month}`;
  const noLogsEver = !!q.data && rows.length === 0 && isCurrent && dash.data?.streak.longest === 0;

  let body;
  if (q.isError && !q.data) {
    body = (
      <StateBlock
        variant="error"
        title={offline ? "You're offline" : "Couldn't load your history"}
        message={offline ? 'Check your connection and try again.' : 'Something went wrong on our side. Try again.'}
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (noLogsEver) {
    body = (
      <StateBlock
        variant="empty"
        title="Your history starts with your first log"
        message="Log a meal and your days will show up here."
        actionLabel="Go to Today"
        onAction={() => router.navigate('/')}
      />
    );
  } else {
    body = (
      <>
        <Swap k={monthKey} dir={dir} slide>
          <MonthCalendar
            year={shown.year}
            month={shown.month}
            rows={rows}
            todayIso={todayIso}
            selected={selected}
            loading={q.isPending}
            onSelect={(date) => {
              hapticSelect();
              setPicked(date);
            }}
          />
        </Swap>
        {q.data ? (
          <>
            <Swap k={selected} dir={dir} slide={false}>
              <SelectedDayCard
                date={selected}
                todayIso={todayIso}
                row={rows.find((r) => r.date === selected)}
                onPress={(date) => router.push({ pathname: '/day', params: { date } })}
              />
            </Swap>
            <HistorySummaryLine {...summary(rows)} streak={dash.data?.streak.current ?? 0} />
          </>
        ) : null}
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
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: colors.textSecondary }]} maxFontSizeMultiplier={1.5}>
              {`${MONTH_NAMES[shown.month - 1]} ${shown.year}`}
            </Text>
            <Text accessibilityRole="header" style={[type.title1, styles.title, { color: colors.text }]} maxFontSizeMultiplier={2}>
              History
            </Text>
          </View>
          <Arrow icon="chevron-back" label="Previous month" onPress={() => move(-1)} />
          <Arrow icon="chevron-forward" label="Next month" disabled={isCurrent} onPress={() => move(1)} />
        </View>
        {q.isError && q.data ? (
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrow: { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_700Bold', textTransform: 'uppercase', letterSpacing: 0.78 },
  title: { fontSize: 32, lineHeight: 38 },
  arrow: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2 },
  arrowInner: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
});
