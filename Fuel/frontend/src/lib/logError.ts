import { ApiError, NetworkError } from '@/api/errors';

/** User-facing text for a failed "log this food" request. Shared by Food detail and Quick Log. */
export function logErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return "You're offline. Check your connection and try again.";
  if (error instanceof ApiError) {
    if (error.status === 404) return 'That food is no longer available';
    if (error.status === 400) return error.message;
  }
  return "Couldn't log this food. Try again.";
}
