import { ApiError, NetworkError } from '@/api/errors';

export type AuthErrorKind = 'offline' | 'rateLimited' | 'unauthorized' | 'forbidden' | 'invalid' | 'generic';

export function classifyAuthError(e: unknown): { kind: AuthErrorKind; retryAfter?: number } {
  if (e instanceof NetworkError) return { kind: 'offline' };
  if (e instanceof ApiError) {
    if (e.status === 429) return { kind: 'rateLimited', retryAfter: e.retryAfter };
    if (e.status === 401) return { kind: 'unauthorized' };
    if (e.status === 403) return { kind: 'forbidden' };
    if (e.status === 400) return { kind: 'invalid' };
  }
  return { kind: 'generic' };
}

const SECONDS_PER_MINUTE = 60;

/** User-facing text for a 429; `retryAfter` is in seconds. */
export function rateLimitMessage(retryAfter?: number) {
  if (!retryAfter || retryAfter <= 0) return 'Too many tries. Try again in a few minutes';
  const minutes = Math.ceil(retryAfter / SECONDS_PER_MINUTE);
  return `Too many tries. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
