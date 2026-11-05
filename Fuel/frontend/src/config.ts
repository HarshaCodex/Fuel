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
