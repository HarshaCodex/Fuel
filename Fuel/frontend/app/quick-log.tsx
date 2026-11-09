import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { foodKeys, getRecentFoods, type RecentFood } from '@/api/food';
import { NetworkError } from '@/api/errors';
import { Banner } from '@/components/Banner';
import { FoodRow } from '@/components/FoodRow';
import { radius, sizing, space, type, useTheme } from '@/theme';

type MethodProps = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

function MethodRow({ icon, label, onPress }: MethodProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.method,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={sizing.icon} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[type.headline, styles.methodText, { color: colors.text }]} maxFontSizeMultiplier={2}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={sizing.icon} color={colors.textTertiary} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
}

function RecentsSkeleton() {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading recent foods" style={styles.skeleton}>
      {[0, 1, 2].map((i) => (
        <View key={i} testID="recent-skeleton-row" style={[styles.skeletonRow, { backgroundColor: colors.surfaceMuted }]} />
      ))}
    </View>
  );
}

export default function QuickLogScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const recents = useQuery({ queryKey: foodKeys.recent, queryFn: () => getRecentFoods(5) });
  const offline = recents.error instanceof NetworkError;

  const openFood = (food: RecentFood) => {
    queryClient.setQueryData(foodKeys.detail(food.id), food);
    router.push({ pathname: '/food-detail', params: { id: food.id } });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[type.title1, { color: colors.text }]} maxFontSizeMultiplier={2}>
            Log food
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={sizing.icon} color={colors.text} />
          </Pressable>
        </View>

        {recents.isError ? (
          <Banner
            variant="caution"
            message={offline ? "You're offline. Recent foods aren't available." : "Couldn't load recents"}
            action={{ label: 'Retry', onPress: () => void recents.refetch() }}
          />
        ) : null}

        <View style={styles.methods}>
          <MethodRow icon="search" label="Search foods" onPress={() => router.push('/search')} />
          <MethodRow icon="barcode-outline" label="Scan barcode" onPress={() => router.push('/scan')} />
          <MethodRow icon="create-outline" label="Enter manually" onPress={() => router.push('/manual-entry')} />
        </View>

        {recents.isPending ? <RecentsSkeleton /> : null}

        {recents.data && recents.data.length > 0 ? (
          <View style={styles.recents}>
            <Text accessibilityRole="header" style={[type.title2, { color: colors.text }]} maxFontSizeMultiplier={2}>
              Recent
            </Text>
            <View style={[styles.list, { borderColor: colors.border }]}>
              {recents.data.map((food, i) => (
                <FoodRow key={food.id} food={food} divider={i < recents.data.length - 1} onPress={() => openFood(food)} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingTop: space.xl, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: sizing.touchMin, height: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  methods: { gap: space.sm },
  method: {
    minHeight: sizing.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: sizing.border,
  },
  methodText: { flex: 1 },
  recents: { gap: space.md, marginTop: space.md },
  list: { borderRadius: radius.md, borderWidth: sizing.border, overflow: 'hidden' },
  skeleton: { gap: space.sm, marginTop: space.md },
  skeletonRow: { height: sizing.row, borderRadius: radius.md },
});
