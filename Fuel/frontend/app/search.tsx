import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NetworkError } from '@/api/errors';
import { foodKeys, getFoodPage, type Food } from '@/api/food';
import { Button } from '@/components/Button';
import { FoodRow } from '@/components/FoodRow';
import { StateBlock } from '@/components/StateBlock';
import { TextField } from '@/components/TextField';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { radius, sizing, space, type, useTheme } from '@/theme';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const SKELETON_DELAY_MS = 200;

export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const active = text.trim().length >= MIN_CHARS && q.length >= MIN_CHARS;

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

  const offline = search.error instanceof NetworkError;
  let body;
  if (!active) {
    body = (
      <Text style={[type.callout, styles.hint, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
        Type at least 2 characters to search foods.
      </Text>
    );
  } else if (search.isError && !search.data) {
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
    body = (
      <View accessible accessibilityLabel="Searching foods" style={styles.skeleton}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} testID="search-skeleton-row" style={[styles.skeletonRow, { backgroundColor: colors.surfaceMuted }]} />
        ))}
      </View>
    );
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
        renderItem={({ item }) => <FoodRow food={item} onPress={() => openFood(item)} />}
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
        style={[styles.list, { borderColor: colors.border }]}
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={sizing.icon} color={colors.text} />
        </Pressable>
        <TextField
          label="Search foods"
          value={text}
          onChangeText={setText}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          placeholder="Chicken, oats, banana"
          maxLength={100}
        />
        {text.length > 0 ? (
          <Button variant="text" size="md" label="Clear" onPress={() => setText('')} />
        ) : null}
      </View>
      <View style={styles.flex}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: space.lg, gap: space.sm },
  back: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  more: { padding: space.md, alignItems: 'center', gap: space.xs },
  hint: { paddingHorizontal: space.lg },
  list: { marginHorizontal: space.lg, borderRadius: radius.md, borderWidth: sizing.border },
  skeleton: { paddingHorizontal: space.lg, gap: space.sm },
  skeletonRow: { height: sizing.row, borderRadius: radius.md },
  empty: { padding: space.lg, gap: space.md },
});
