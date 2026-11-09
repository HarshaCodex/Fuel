import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '@/api/errors';
import { deleteCustomFood, foodKeys, getCustomFoodPage, type Food, type FoodPage } from '@/api/food';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CustomFoodRow } from '@/components/CustomFoodRow';
import { StateBlock } from '@/components/StateBlock';
import { radius, sizing, space, type, useTheme } from '@/theme';

const PAGE_SIZE = 20;

export default function MyFoodsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [pendingDelete, setPendingDelete] = useState<Food | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const busy = useRef(false);
  const [dialogName, setDialogName] = useState('food');

  const list = useInfiniteQuery({
    queryKey: foodKeys.custom,
    queryFn: ({ pageParam }) => getCustomFoodPage(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });

  const foods = useMemo(() => {
    const byId = new Map<string, Food>();
    for (const page of list.data?.pages ?? []) {
      for (const food of page.content) if (!byId.has(food.id)) byId.set(food.id, food);
    }
    return [...byId.values()];
  }, [list.data]);

  const openFood = (food: Food) => {
    queryClient.setQueryData(foodKeys.detail(food.id), food);
    router.push({ pathname: '/food-detail', params: { id: food.id } });
  };

  const editFood = (food: Food) => {
    queryClient.setQueryData(foodKeys.detail(food.id), food);
    router.push({ pathname: '/manual-entry', params: { id: food.id } });
  };

  const removeFromCache = (id: string) => {
    queryClient.setQueryData<InfiniteData<FoodPage, number>>(foodKeys.custom, (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, content: p.content.filter((f) => f.id !== id) })) } : old,
    );
    queryClient.removeQueries({ queryKey: foodKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: foodKeys.custom });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busy.current) return;
    busy.current = true;
    setDeleting(true);
    try {
      await deleteCustomFood(pendingDelete.id);
      removeFromCache(pendingDelete.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        removeFromCache(pendingDelete.id);
      } else {
        setDeleteError(
          e instanceof NetworkError ? "You're offline. The food wasn't deleted." : "Couldn't delete the food. Try again.",
        );
      }
    } finally {
      busy.current = false;
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const offline = list.error instanceof NetworkError;
  let body;
  if (list.isError && !list.data) {
    body = (
      <StateBlock
        variant="error"
        title={offline ? "You're offline" : "Couldn't load My Foods"}
        message={offline ? 'Check your connection and try again.' : 'Something went wrong. Try again.'}
        actionLabel="Retry"
        onAction={() => void list.refetch()}
      />
    );
  } else if (list.isPending) {
    body = (
      <View accessible accessibilityLabel="Loading My Foods" style={styles.skeleton}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} testID="my-foods-skeleton-row" style={[styles.skeletonRow, { backgroundColor: colors.surfaceMuted }]} />
        ))}
      </View>
    );
  } else if (foods.length === 0) {
    body = (
      <StateBlock
        variant="empty"
        title="Foods you create show up here"
        message="Enter a food once, then log it any time."
        actionLabel="Enter a food"
        onAction={() => router.push({ pathname: '/manual-entry', params: { mode: 'create' } })}
      />
    );
  } else {
    body = (
      <FlatList
        testID="my-foods-list"
        data={foods}
        keyExtractor={(f) => f.id}
        renderItem={({ item, index }) => (
          <CustomFoodRow
            food={item}
            divider={index < foods.length - 1}
            onPress={() => openFood(item)}
            onEdit={() => editFood(item)}
            onDelete={() => {
              setDeleteError(null);
              setDialogName(item.name);
              setPendingDelete(item);
            }}
          />
        )}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage({ cancelRefetch: false });
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator accessibilityLabel="Loading more" color={colors.accent} />
          ) : list.isError ? (
            <View style={styles.more}>
              <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
                {"Couldn't load more"}
              </Text>
              <Button variant="text" size="md" label="Retry" onPress={() => void list.fetchNextPage()} />
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
        <Text accessibilityRole="header" style={[type.title1, styles.title, { color: colors.text }]} maxFontSizeMultiplier={2}>
          My Foods
        </Text>
        <Button
          variant="text"
          size="md"
          label="New food"
          onPress={() => router.push({ pathname: '/manual-entry', params: { mode: 'create' } })}
        />
      </View>
      {list.isError && list.data && offline ? (
        <View style={styles.banner}>
          <Banner variant="caution" message="You're offline. Showing what was loaded." />
        </View>
      ) : null}
      {deleteError ? (
        <View style={styles.banner}>
          <Banner variant="danger" message={deleteError} />
        </View>
      ) : null}
      <View style={styles.flex}>{body}</View>
      <ConfirmDialog
        visible={pendingDelete !== null}
        title={`Delete ${dialogName}?`}
        message="It will be removed from My Foods. Meals you already logged keep their entries."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  back: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  banner: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  list: { flexGrow: 0, marginHorizontal: space.lg, borderRadius: radius.md, borderWidth: sizing.border },
  more: { padding: space.md, alignItems: 'center', gap: space.xs },
  skeleton: { paddingHorizontal: space.lg, gap: space.sm },
  skeletonRow: { height: sizing.row, borderRadius: radius.md },
});
