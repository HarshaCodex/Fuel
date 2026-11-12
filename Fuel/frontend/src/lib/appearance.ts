import { Appearance, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AppearanceChoice = 'system' | 'light' | 'dark';

// Display preference only. Deliberately not cleared on sign-out: it belongs to the phone, not the account.
const KEY = 'fuel.appearance';

// SecureStore does not exist on web; keep the choice in memory only.
let memoryValue: AppearanceChoice = 'system';

export const APPEARANCE_OPTIONS: { value: AppearanceChoice; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Match your phone' },
  { value: 'light', label: 'Light', description: 'Always light' },
  { value: 'dark', label: 'Dark', description: 'Always dark' },
];

const isChoice = (v: unknown): v is AppearanceChoice => v === 'system' || v === 'light' || v === 'dark';

export function appearanceLabel(choice: AppearanceChoice): string {
  return APPEARANCE_OPTIONS.find((o) => o.value === choice)?.label ?? 'System';
}

/** Synchronous read so the theme is right before the first frame. Missing or bad values mean System. */
export function getAppearance(): AppearanceChoice {
  try {
    const raw = Platform.OS === 'web' ? memoryValue : SecureStore.getItem(KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

function applyChoice(choice: AppearanceChoice) {
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
}

export function applyStoredAppearance(): void {
  applyChoice(getAppearance());
}

/** Applies the choice immediately, then saves it. A failed save only loses persistence. */
export function setAppearance(choice: AppearanceChoice): void {
  applyChoice(choice);
  if (Platform.OS === 'web') {
    memoryValue = choice;
    return;
  }
  try {
    SecureStore.setItem(KEY, choice);
  } catch {
    // keep the applied choice for this session
  }
}
