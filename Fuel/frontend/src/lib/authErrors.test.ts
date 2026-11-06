import { ApiError, NetworkError } from '@/api/errors';

import { classifyAuthError, rateLimitMessage } from './authErrors';

describe('classifyAuthError', () => {
  it('maps network failures to offline', () => {
    expect(classifyAuthError(new NetworkError())).toEqual({ kind: 'offline' });
  });
  it('maps statuses', () => {
    expect(classifyAuthError(new ApiError(401, 'x')).kind).toBe('unauthorized');
    expect(classifyAuthError(new ApiError(403, 'x')).kind).toBe('forbidden');
    expect(classifyAuthError(new ApiError(400, 'x')).kind).toBe('invalid');
    expect(classifyAuthError(new ApiError(500, 'x')).kind).toBe('generic');
  });
  it('carries retryAfter on 429', () => {
    expect(classifyAuthError(new ApiError(429, 'x', [], 90))).toEqual({ kind: 'rateLimited', retryAfter: 90 });
    expect(classifyAuthError(new ApiError(429, 'x'))).toEqual({ kind: 'rateLimited', retryAfter: undefined });
  });
  it('treats unknown errors as generic', () => {
    expect(classifyAuthError(new Error('boom')).kind).toBe('generic');
  });
});

describe('rateLimitMessage', () => {
  it('uses singular and rounds up minutes', () => {
    expect(rateLimitMessage(60)).toBe('Too many tries. Try again in 1 minute');
    expect(rateLimitMessage(61)).toBe('Too many tries. Try again in 2 minutes');
  });
  it('falls back without a usable retryAfter', () => {
    expect(rateLimitMessage(undefined)).toBe('Too many tries. Try again in a few minutes');
    expect(rateLimitMessage(0)).toBe('Too many tries. Try again in a few minutes');
  });
});
