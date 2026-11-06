const LENGTH_MIN = 8;
const LENGTH_MAX = 64;
const BYTES_MAX = 72;

export type PasswordRule = { id: 'length' | 'lower' | 'upper' | 'digit' | 'symbol'; label: string; test: (v: string) => boolean };

/** The rules shown as a tick list. Mirrors the backend's new-password policy. */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `${LENGTH_MIN}-${LENGTH_MAX} characters`, test: (v) => v.length >= LENGTH_MIN && v.length <= LENGTH_MAX },
  { id: 'lower', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v) => /[0-9]/.test(v) },
  { id: 'symbol', label: 'A symbol', test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

export const PASSWORD_RULES_SUMMARY = '8+ characters with upper and lower case, a number and a symbol';
const MAX_BYTES_MESSAGE = 'Use at most 72 bytes.';

const tooManyBytes = (v: string) => new TextEncoder().encode(v).length > BYTES_MAX;

/** Which of the tick-list rules pass, plus whether the (hidden) 72-byte limit is exceeded. */
export function checkPassword(v: string): { met: Record<PasswordRule['id'], boolean>; bytesExceeded: boolean } {
  const met = Object.fromEntries(PASSWORD_RULES.map((r) => [r.id, r.test(v)])) as Record<PasswordRule['id'], boolean>;
  return { met, bytesExceeded: tooManyBytes(v) };
}

/** Returns an error message, or null when the password meets every rule. */
export function validateNewPassword(v: string): string | null {
  const { met, bytesExceeded } = checkPassword(v);
  if (bytesExceeded) return MAX_BYTES_MESSAGE;
  return Object.values(met).every(Boolean) ? null : 'Choose a password that meets all the rules.';
}
