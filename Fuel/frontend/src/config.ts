/** Returns the API base URL from `EXPO_PUBLIC_API_BASE_URL` without a trailing slash. */
export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must start with http:// or https://');
  }
  return raw.replace(/\/+$/, '');
}

/** Google OAuth client IDs. They are public identifiers, not secrets. The web ID is the ID token audience on both platforms. */
export function getGoogleClientIds(): { webClientId: string; iosClientId?: string } {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
  }
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined;
  return { webClientId, iosClientId };
}
