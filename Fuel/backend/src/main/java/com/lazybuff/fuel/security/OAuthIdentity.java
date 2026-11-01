package com.lazybuff.fuel.security;

import com.lazybuff.fuel.util.AuthProvider;

/**
 * Identity claims from a verified OAuth provider token (Google ID token, Apple identity token).
 *
 * @param provider the provider that verified the user
 * @param subject the provider's stable account id ({@code sub}); never changes, unlike email
 * @param email lower-cased email address the provider has verified, or {@code null} if it shared
 *     none (Apple can omit it)
 * @param name display name, may be {@code null}
 */
public record OAuthIdentity(AuthProvider provider, String subject, String email, String name) {}
