import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getBodyStats, getGoals, getProfile, userKeys, type Goals } from '@/api/user';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { FormScreen } from '@/components/FormScreen';
import { appearanceLabel, getAppearance } from '@/lib/appearance';
import { classifyAuthError } from '@/lib/authErrors';
import { activityLabel, BODY_STATS_UI, summarizeBodyStats } from '@/lib/bodyStatsForm';
import { GOALS_MESSAGES, summarizeGoals } from '@/lib/goalsForm';
import { PROFILE_MESSAGES } from '@/lib/profileForm';
import { useSession } from '@/session/SessionProvider';
import { radius, shadow, sizing, space, type, useTheme } from '@/theme';

const noteFor = (g: Goals) =>
  g.updatedAt === null ? 'Default targets. Set yours' : g.isAutoCalculated ? 'Calculated from your body stats' : 'Set by you';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [appearance, setAppearanceState] = useState(getAppearance);
  useFocusEffect(useCallback(() => setAppearanceState(getAppearance()), []));
  const goals = useQuery({ queryKey: userKeys.goals, queryFn: getGoals });
  const profile = useQuery({ queryKey: userKeys.profile, queryFn: getProfile });
  const body = useQuery({ queryKey: userKeys.bodyStats, queryFn: getBodyStats });
  const account = profile.data;
  const data = goals.data;
  const calories = data ? `${Math.round(data.calorieGoal).toLocaleString('en-US')} kcal` : '';
  const summary = data ? summarizeGoals(data) : '';

  return (
    <FormScreen>
      <Text style={[type.title1, { color: colors.text }]} accessibilityRole="header" maxFontSizeMultiplier={2}>
        Profile
      </Text>
      {profile.isError && !account ? (
        <Banner
          variant="danger"
          message={classifyAuthError(profile.error).kind === 'offline' ? PROFILE_MESSAGES.offline : PROFILE_MESSAGES.loadFailed}
          action={{ label: 'Retry', onPress: () => void profile.refetch() }}
        />
      ) : (
        <View style={[styles.account, shadow.sm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {account ? (
            <>
              <View style={styles.identity}>
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]} accessibilityElementsHidden importantForAccessibility="no">
                  <Text style={[type.title2, { color: colors.accentText }]}>{account.name.trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.identityText}>
                  <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>{account.name}</Text>
                  <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>{account.email}</Text>
                  <Text style={[type.caption, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>{account.timezone}</Text>
                </View>
              </View>
              <Button label="Edit profile" variant="secondary" size="md" onPress={() => router.push('/edit-profile')} />
            </>
          ) : (
            <Text style={[type.callout, { color: colors.textSecondary }]}>Loading profile</Text>
          )}
        </View>
      )}
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
      {body.isError && !body.data ? (
        <Banner
          variant="danger"
          message={classifyAuthError(body.error).kind === 'offline' ? BODY_STATS_UI.offline : BODY_STATS_UI.loadFailed}
          action={{ label: 'Retry', onPress: () => void body.refetch() }}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          body.data ? `Edit body stats. ${summarizeBodyStats(body.data)}. ${activityLabel(body.data.activityLevel)}` : body.data === null ? 'Add your body stats' : 'Edit body stats'
        }
        accessibilityState={{ disabled: body.data === undefined }}
        disabled={body.data === undefined}
        onPress={() => router.push('/edit-body-stats')}
        style={({ pressed }) => [
          styles.card,
          shadow.sm,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[type.caption, { color: colors.textSecondary }]}>Body stats</Text>
        {body.data ? (
          <>
            <Text style={[type.headline, { color: colors.text }]} maxFontSizeMultiplier={2}>{summarizeBodyStats(body.data)}</Text>
            <Text style={[type.callout, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>{activityLabel(body.data.activityLevel)}</Text>
          </>
        ) : body.isPending ? (
          <Text style={[type.callout, { color: colors.textSecondary }]}>Loading body stats</Text>
        ) : null}
        <View style={styles.cta}>
          <Text style={[type.callout, { color: colors.accentText }]}>{body.data === null ? 'Add your body stats' : 'Edit body stats'}</Text>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Appearance. ${appearanceLabel(appearance)}`}
        onPress={() => router.push('/appearance')}
        style={({ pressed }) => [
          styles.link,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[type.headline, styles.linkText, { color: colors.text }]} maxFontSizeMultiplier={2}>
          Appearance
        </Text>
        <Text style={[type.callout, styles.value, { color: colors.textSecondary }]} maxFontSizeMultiplier={2}>
          {appearanceLabel(appearance)}
        </Text>
        <Text style={[type.headline, { color: colors.textTertiary }]} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.link,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[type.headline, styles.linkText, { color: colors.text }]} maxFontSizeMultiplier={2}>
          Sign out
        </Text>
      </Pressable>
      {account ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={() => setDeleting(true)}
            style={styles.delete}
          >
            <Text style={[type.callout, { color: colors.danger }]} maxFontSizeMultiplier={2}>Delete account</Text>
          </Pressable>
          <DeleteAccountDialog
            visible={deleting}
            provider={account.authProvider}
            onClose={() => setDeleting(false)}
            onDeleted={() => {
              setDeleting(false);
              void signOut();
            }}
          />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  account: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identityText: { flex: 1, gap: space.xs },
  avatar: { width: sizing.avatar, height: sizing.avatar, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: sizing.border, padding: space.lg, gap: space.xs, minHeight: sizing.touchMin },
  link: { minHeight: sizing.row, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderRadius: radius.lg, borderWidth: sizing.border },
  linkText: { flex: 1 },
  value: { marginRight: space.sm },
  delete: { minHeight: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  cta: { minHeight: sizing.touchMin, justifyContent: 'center' },
});
