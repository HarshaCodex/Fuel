package com.lazybuff.fuel.security;

/**
 * A verified Apple identity token.
 *
 * @param identity the user's Apple identity
 * @param clientId the client ID (bundle ID or Services ID) the token was issued to
 */
public record VerifiedAppleToken(OAuthIdentity identity, String clientId) {}
