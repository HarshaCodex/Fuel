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
