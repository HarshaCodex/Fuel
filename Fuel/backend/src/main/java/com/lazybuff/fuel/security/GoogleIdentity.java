package com.lazybuff.fuel.security;

/**
 * Verified identity claims from a Google ID token.
 *
 * @param subject Google's stable account id ({@code sub}); never changes, unlike email
 * @param email verified email address
 * @param name display name, may be {@code null}
 */
public record GoogleIdentity(String subject, String email, String name) {}
