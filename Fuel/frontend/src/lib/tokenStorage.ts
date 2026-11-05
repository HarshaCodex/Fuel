import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Tokens = { accessToken: string; refreshToken: string };

const KEY = 'fuel.tokens';

// SecureStore does not exist on web; keep tokens in memory only (never localStorage).
let memoryValue: string | null = null;
const isWeb = () => Platform.OS === 'web';

export async function getTokens(): Promise<Tokens | null> {
  const raw = isWeb() ? memoryValue : await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  const raw = JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  if (isWeb()) {
    memoryValue = raw;
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

export async function clearTokens(): Promise<void> {
  if (isWeb()) {
    memoryValue = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
