import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { getGoogleClientIds } from '@/config';

export type AppleCredential = {
  identityToken: string;
  authorizationCode?: string;
  fullName?: { givenName?: string; familyName?: string };
};

let googleConfigured = false;

/**
 * Google sign-in is a native module that Expo Go doesn't include, so it works only in a development or store
 * build. In Expo Go the button is hidden and the rest of the app still runs.
 */
export function isGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** Resolves with the Google ID token, or null when the user cancels. Never logs the token. */
export async function signInWithGoogle(): Promise<{ idToken: string } | null> {
  if (!isGoogleSignInAvailable()) throw new Error('Google sign-in needs a development build, not Expo Go');
  // Loaded on first use: importing it at startup crashes Expo Go, which lacks the native module.
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  if (!googleConfigured) {
    const { webClientId, iosClientId } = getGoogleClientIds();
    GoogleSignin.configure({ webClientId, iosClientId });
    googleConfigured = true;
  }
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google did not return an ID token');
  return { idToken };
}

/** Resolves with the Apple credential, or null when the user cancels. Never logs the token. */
export async function signInWithApple(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple did not return an identity token');
    const { givenName, familyName } = credential.fullName ?? {};
    return {
      identityToken: credential.identityToken,
      ...(credential.authorizationCode ? { authorizationCode: credential.authorizationCode } : {}),
      // Apple only returns the name on the first sign-in.
      ...(givenName || familyName
        ? { fullName: { ...(givenName ? { givenName } : {}), ...(familyName ? { familyName } : {}) } }
        : {}),
    };
  } catch (e) {
    if ((e as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

/** The Apple button is shown on iOS only, and only when the device supports it. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
