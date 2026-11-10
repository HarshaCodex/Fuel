import { deviceTimezone } from '@/lib/timezones';

import { apiClient } from './client';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type UserData = AuthTokens & {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isNewUser?: boolean;
};

export const login = (email: string, password: string) =>
  apiClient.request<UserData>('POST', '/api/auth/login', { body: { email, password } });

export const refresh = (refreshToken: string) =>
  apiClient.request<AuthTokens>('POST', '/api/auth/refresh', { body: { refreshToken } });

/** Logout is an authenticated route; the caller passes the access token it captured before clearing local state. */
export const logout = (refreshToken: string, accessToken: string) =>
  apiClient.request<null>('POST', '/api/auth/logout', { body: { refreshToken }, bearer: accessToken });

export type RegisterInput = { email: string; password: string; name: string; timezone: string };

/** 202 with no body; the same answer for an already-registered email. */
export const register = (input: RegisterInput) =>
  apiClient.request<null>('POST', '/api/auth/register', { body: input });

export const verifyEmail = (email: string, verificationCode: string) =>
  apiClient.request<UserData>('POST', '/api/auth/verify-email', { body: { email, verificationCode } });

export const resendVerification = (email: string) =>
  apiClient.request<{ emailVerified: boolean }>('POST', '/api/auth/resend-verification', { body: { email } });

/** Always 200 whether or not the email exists. */
export const forgotPassword = (email: string) =>
  apiClient.request<null>('POST', '/api/auth/forgot-password', { body: { email } });

export const resetPassword = (email: string, resetCode: string, newPassword: string) =>
  apiClient.request<null>('POST', '/api/auth/reset-password', { body: { email, resetCode, newPassword } });

export const oauthGoogle = (idToken: string) =>
  apiClient.request<UserData>('POST', '/api/auth/oauth/google', { body: { idToken, timezone: deviceTimezone() } });

export type AppleOAuthInput = {
  identityToken: string;
  authorizationCode?: string;
  fullName?: { givenName?: string; familyName?: string };
};

export const oauthApple = (input: AppleOAuthInput) =>
  apiClient.request<UserData>('POST', '/api/auth/oauth/apple', { body: { ...input, timezone: deviceTimezone() } });
