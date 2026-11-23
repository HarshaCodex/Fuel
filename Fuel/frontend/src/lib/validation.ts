const EMAIL_RE = /^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const EMAIL_MAX = 255;
const PASSWORD_MAX = 128;

/** Returns an error message, or null when valid. Callers trim the value first. */
export function validateEmail(value: string): string | null {
  const v = value.trim();
  return v.length > 0 && v.length <= EMAIL_MAX && EMAIL_RE.test(v) ? null : 'Enter a valid email address.';
}

/** Login only checks presence and length; complexity rules apply when choosing a password. */
export function validateLoginPassword(value: string): string | null {
  return value.length > 0 && value.length <= PASSWORD_MAX ? null : 'Enter your password.';
}
