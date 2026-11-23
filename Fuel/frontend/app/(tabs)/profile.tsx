import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { foodKeys, getCustomFoodPage } from '@/api/food';
import { getBodyStats, getGoals, getProfile, userKeys } from '@/api/user';
import { Banner } from '@/components/Banner';
import { BodyStatsCard } from '@/components/BodyStatsCard';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { FormScreen } from '@/components/FormScreen';
import { GoalCard } from '@/components/GoalCard';
import { ProfileHeader } from '@/components/ProfileHeader';
import { ProfileRows } from '@/components/ProfileRows';
import { ProfileSkeleton } from '@/components/ProfileSkeleton';
import { appearanceLabel, getAppearance } from '@/lib/appearance';
import { classifyAuthError } from '@/lib/authErrors';
import { BODY_STATS_UI } from '@/lib/bodyStatsForm';
import { GOALS_MESSAGES } from '@/lib/goalsForm';
import { PROFILE_MESSAGES } from '@/lib/profileForm';
import { customFoodsValue } from '@/lib/profileView';
import { useSession } from '@/session/SessionProvider';
import { sizing, useTheme } from '@/theme';

const offlineOr = (error: unknown, offline: string, failed: string) =>
  classifyAuthError(error).kind === 'offline' ? offline : failed;

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
  const customCount = useQuery({ queryKey: foodKeys.customCount, queryFn: async () => (await getCustomFoodPage(0, 1)).totalElements });
  // Count the calories up only when the goals were not already cached on first render.
  const [countUp] = useState(() => goals.data === undefined);
  const account = profile.data;

  return (
    <FormScreen>
      {profile.isError && !account ? (
        <Banner
          variant="danger"
          message={offlineOr(profile.error, PROFILE_MESSAGES.offline, PROFILE_MESSAGES.loadFailed)}
          action={{ label: 'Retry', onPress: () => void profile.refetch() }}
        />
      ) : account ? (
        <ProfileHeader name={account.name} email={account.email} onEdit={() => router.push('/edit-profile')} />
      ) : (
        <ProfileSkeleton header />
      )}
      {goals.data ? (
        <GoalCard goals={goals.data} countUp={countUp} onEdit={() => router.push('/edit-goals')} />
      ) : goals.isError ? (
        <Banner
          variant="danger"
          message={offlineOr(goals.error, GOALS_MESSAGES.offline, GOALS_MESSAGES.loadFailed)}
          action={{ label: 'Retry', onPress: () => void goals.refetch() }}
        />
      ) : (
        <ProfileSkeleton goals />
      )}
      {body.data !== undefined ? (
        <BodyStatsCard stats={body.data} onPress={() => router.push('/edit-body-stats')} />
      ) : body.isError ? (
        <Banner
          variant="danger"
          message={offlineOr(body.error, BODY_STATS_UI.offline, BODY_STATS_UI.loadFailed)}
          action={{ label: 'Retry', onPress: () => void body.refetch() }}
        />
      ) : (
        <ProfileSkeleton body />
      )}
      <ProfileRows
        customFoods={customFoodsValue(customCount.data)}
        appearance={appearanceLabel(appearance)}
        onMyFoods={() => router.push('/my-foods')}
        onAppearance={() => router.push('/appearance')}
        onSignOut={() => void signOut()}
      />
      {account ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete account" onPress={() => setDeleting(true)} style={styles.delete}>
            <Text style={[styles.deleteText, { color: colors.danger }]} maxFontSizeMultiplier={1.5}>
              Delete account
            </Text>
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
  delete: { minHeight: sizing.touchMin, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 15, lineHeight: 20, fontFamily: 'Manrope_700Bold' },
});
