import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FirstRunGate } from '@/session/FirstRunGate';
import { SessionProvider, useSession } from '@/session/SessionProvider';

function RootStack() {
  const { status } = useSession();
  if (status === 'loading') return null;
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="edit-goals" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-body-stats" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quick-log" options={{ presentation: 'modal' }} />
          <Stack.Screen name="search" />
          <Stack.Screen name="food-detail" />
          <Stack.Screen name="scan" />
          <Stack.Screen name="manual-entry" />
          <Stack.Screen name="my-foods" />
          <Stack.Screen name="day" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {status === 'signedIn' ? <FirstRunGate /> : null}
    </>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
