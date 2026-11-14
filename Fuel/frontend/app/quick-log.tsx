import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NetworkError } from '@/api/errors';
import { foodKeys, getFoodPage, getRecentFoods, type Food } from '@/api/food';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { useCardStyle } from '@/components/cardStyle';
import { FoodResultRow } from '@/components/FoodResultRow';
import { QuickLogSheet } from '@/components/QuickLogSheet';
import { QuickLogTile } from '@/components/QuickLogTile';
import { StateBlock } from '@/components/StateBlock';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { radius, sizing, space, type, useTheme } from '@/theme';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const SKELETON_DELAY_MS = 200;

function Skeleton({ label, testID, rows }: { label: string; testID: string; rows: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={styles.skeleton}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} testID={testID} style={[styles.skeletonRow, { backgroundColor: colors.surfaceMuted }]} />
      ))}
    </View>
  );
}

export default function QuickLogScreen() {
  const router = useRouter();
  return <QuickLogSheet onClose={() => router.back()}>{(close) => <QuickLogContent close={close} />}</QuickLogSheet>;
}

function QuickLogContent({ close }: { close: () => void }) {
  const { colors } = useTheme();
  const card = useCardStyle();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const q = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const active = text.trim().length >= MIN_CHARS && q.length >= MIN_CHARS;

  useFocusEffect(
    useCallback(() => {
      if (focus === '1') input.current?.focus();
    }, [focus]),
  );

  const recents = useQuery({ queryKey: foodKeys.recent, queryFn: () => getRecentFoods(5) });
  const search = useInfiniteQuery({
    queryKey: foodKeys.search(q),
    queryFn: ({ pageParam }) => getFoodPage(q, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    enabled: active,
  });

  const loading = active && ((search.isPending && !search.isError) || (search.isFetching && !search.data));
  const showSkeleton = useDebouncedValue(loading, SKELETON_DELAY_MS) && loading;

  const foods = useMemo(() => {
    const byId = new Map<string, Food>();
    for (const page of search.data?.pages ?? []) {
      for (const food of page.content) if (!byId.has(food.id)) byId.set(food.id, food);
    }
    return [...byId.values()];
  }, [search.data]);

  const openFood = (food: Food) => {
    queryClient.setQueryData(foodKeys.detail(food.id), food);
    router.push({ pathname: '/food-detail', params: { id: food.id } });
  };

  const field = (
    <View style={styles.searchRow}>
      <View
        collapsable={false}
        style={[
          styles.pill,
          { backgroundColor: colors.surface, borderColor: focused ? colors.accent : colors.border, borderWidth: focused ? sizing.borderFocus : sizing.border },
        ]}
      >
        <Ionicons name="search" size={sizing.icon} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          maxLength={100}
          placeholder="Search foods"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Search foods"
          selectionColor={colors.accent}
          style={[type.body, styles.input, { color: colors.text }]}
          maxFontSizeMultiplier={2}
        />
        {text.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setText('')} style={styles.clear}>
            <Ionicons name="close-circle" size={sizing.icon} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={close}
        style={[styles.closeBtn, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="close" size={sizing.icon} color={colors.text} />
      </Pressable>
    </View>
  );

  const rows = (list: Food[]) => (
    <View style={[styles.card, card]}>
      {list.map((food, i) => (
        <FoodResultRow key={food.id} food={food} divider={i < list.length - 1} onPress={() => openFood(food)} />
      ))}
    </View>
  );
  const eyebrow = (label: string) => (
    <Text accessibilityRole="header" style={[type.eyebrow, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
      {label}
    </Text>
  );

  const recentsOffline = recents.error instanceof NetworkError;
  let content: ReactNode;
  if (active) {
    const offline = search.error instanceof NetworkError;
    let body;
    if (search.isError && !search.data) {
      body = (
        <StateBlock
          variant="error"
          title={offline ? "You're offline" : "Couldn't search"}
          message={offline ? 'Check your connection and try again.' : 'Something went wrong. Your search is kept.'}
          actionLabel="Retry"
          onAction={() => void search.refetch()}
        />
      );
    } else if (showSkeleton) {
      body = <Skeleton label="Searching foods" testID="search-skeleton-row" rows={4} />;
    } else if (search.data && foods.length === 0) {
      body = (
        <View style={styles.empty}>
          <StateBlock
            variant="empty"
            title={`No match for '${q}'`}
            message="Try another spelling, or add it yourself."
            actionLabel="Enter it manually"
            onAction={() => router.push({ pathname: '/manual-entry', params: { name: q } })}
          />
          <Button variant="secondary" label="Scan barcode" onPress={() => router.push('/scan')} />
        </View>
      );
    } else if (search.data) {
      body = (
        <FlatList
          testID="search-list"
          data={foods}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<View style={styles.label}>{eyebrow('Results')}</View>}
          renderItem={({ item, index }) => (
            <View style={[index === 0 && styles.cardTop, index === foods.length - 1 && styles.cardBottom, card, styles.flatRow]}>
              <FoodResultRow food={item} divider={index < foods.length - 1} onPress={() => openFood(item)} />
            </View>
          )}
          onEndReached={() => {
            if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage({ cancelRefetch: false });
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            search.isFetchingNextPage ? (
              <ActivityIndicator accessibilityLabel="Loading more" color={colors.accent} />
            ) : search.isError ? (
              <View style={styles.more}>
                <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
                  {"Couldn't load more"}
                </Text>
                <Button variant="text" size="md" label="Retry" onPress={() => void search.fetchNextPage()} />
              </View>
            ) : undefined
          }
          contentContainerStyle={styles.listContent}
        />
      );
    }
    content = <View style={styles.flex}>{body}</View>;
  } else {
    content = (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.tiles}>
          <QuickLogTile icon="barcode-outline" label="Scan" hint="Scan a barcode" onPress={() => router.push('/scan')} />
          <QuickLogTile icon="create-outline" label="Manual" hint="Enter a food by hand" onPress={() => router.push('/manual-entry')} />
          <QuickLogTile icon="bookmark-outline" label="My Foods" hint="Your saved foods" onPress={() => router.push('/my-foods')} />
        </View>
        {recents.isError ? (
          <Banner
            variant="caution"
            message={recentsOffline ? "You're offline. Recent foods aren't available." : "Couldn't load recents"}
            action={{ label: 'Retry', onPress: () => void recents.refetch() }}
          />
        ) : null}
        {recents.isPending ? <Skeleton label="Loading recent foods" testID="recent-skeleton-row" rows={3} /> : null}
        {recents.data && recents.data.length > 0 ? (
          <View style={styles.recents}>
            {eyebrow('Recent')}
            {rows(recents.data)}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // One stable tree: the field must not remount when switching between browse and typing.
  return (
    <View style={styles.flex}>
      <View style={styles.pad}>{field}</View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.lg },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.lg, gap: space.lg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { flex: 1, height: sizing.input, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.xs },
  input: { flex: 1, paddingVertical: 0 },
  clear: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: sizing.touchMin, height: sizing.touchMin, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: space.md },
  recents: { gap: space.sm },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  label: { paddingTop: space.lg, paddingBottom: space.sm },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  flatRow: { borderRadius: 0 },
  cardTop: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  cardBottom: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  more: { padding: space.md, alignItems: 'center', gap: space.xs },
  skeleton: { gap: space.sm },
  skeletonRow: { height: sizing.row, borderRadius: radius.md },
  empty: { padding: space.lg, gap: space.md },
});
