import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getGoals, userKeys, type Goals } from '@/api/user';
import { Banner } from '@/components/Banner';
import { FormScreen } from '@/components/FormScreen';
import { classifyAuthError } from '@/lib/authErrors';
import { GOALS_MESSAGES, summarizeGoals } from '@/lib/goalsForm';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

const noteFor = (g: Goals) =>
  g.updatedAt === null ? 'Default targets. Set yours' : g.isAutoCalculated ? 'Calculated from your body stats' : 'Set by you';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const goals = useQuery({ queryKey: userKeys.goals, queryFn: getGoals });
  const data = goals.data;
  const calories = data ? `${Math.round(data.calorieGoal).toLocaleString('en-US')} kcal` : '';
  const summary = data ? summarizeGoals(data) : '';

  return (
    <FormScreen>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Profile
      </Text>
      {goals.isError && !data ? (
        <Banner
          variant="danger"
          message={classifyAuthError(goals.error).kind === 'offline' ? GOALS_MESSAGES.offline : GOALS_MESSAGES.loadFailed}
          action={{ label: 'Retry', onPress: () => void goals.refetch() }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={data ? `Edit goals. ${calories}. ${summary}. ${noteFor(data)}` : 'Edit goals'}
        accessibilityState={{ disabled: !data }}
        disabled={!data}
        onPress={() => router.push('/edit-goals')}
        style={({ pressed }) => [
          styles.card,
          shadow.sm,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[type.caption, { color: colors.textSecondary }]}>Goals</Text>
        {data ? (
          <>
            <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>{calories}</Text>
            <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>{summary}</Text>
            <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>{noteFor(data)}</Text>
          </>
        ) : goals.isPending ? (
          <Text style={[type.callout, { color: colors.textSecondary }]}>Loading goals</Text>
        ) : null}
        <View style={styles.cta}>
          <Text style={[type.callout, { color: colors.accentText }]}>Edit goals</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My Foods"
        onPress={() => router.push('/my-foods')}
        style={({ pressed }) => [
          styles.link,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[type.headline, styles.linkText, { color: colors.text }]} maxFontSizeMultiplier={2}>
          My Foods
        </Text>
        <Text style={[type.headline, { color: colors.textTertiary }]} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </Pressable>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.xs, minHeight: sizing.touchMin },
  link: { minHeight: sizing.row, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderRadius: radius.lg, borderWidth: sizing.border },
  linkText: { flex: 1 },
  cta: { minHeight: sizing.touchMin, justifyContent: 'center' },
});
