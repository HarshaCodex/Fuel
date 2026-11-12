import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { applyStoredAppearance } from '@/lib/appearance';
import { FirstRunGate } from '@/session/FirstRunGate';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';

// Set the saved light/dark override before anything renders, so there is no flash of the wrong theme.
applyStoredAppearance();

// Keep the splash up until the fonts are ready, so text never flashes in the system font.
void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Status bar icons follow the resolved scheme (the in-app choice may differ from the OS). */
export function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />;
}

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
          <Stack.Screen name="appearance" options={{ presentation: 'modal' }} />
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
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const fontsDone = fontsLoaded || fontError !== null;
  useEffect(() => {
    // On a load error the system font is used instead (unknown fontFamily falls back).
    if (fontsDone) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  if (!fontsDone) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <ThemedStatusBar />
          <RootStack />
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
