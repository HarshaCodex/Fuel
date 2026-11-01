package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.AppleOAuthConfig;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.util.AuthProvider;
import com.lazybuff.fuel.util.EmailNormalizer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Verifies Sign in with Apple identity tokens locally against Apple's published RSA keys.
 *
 * <p>Checks signature (RS256 only), expiry, issuer and audience (one of our client IDs). Apple's
 * keys are cached by {@link JwksKeyCache}.
 *
 * <p>The email is only returned when Apple marks it verified; otherwise it is left {@code null} so
 * it can never be used to link or create an account. Apple's private-relay addresses ({@code
 * ...@privaterelay.appleid.com}) are verified and treated like any other email.
 */
@Component
@Slf4j
public class AppleIdTokenVerifier {

    private static final String INVALID_TOKEN_MESSAGE = "Invalid Apple identity token";

    private final AppleOAuthConfig appleOAuthConfig;

    private final JwksKeyCache keyCache;

    public AppleIdTokenVerifier(AppleOAuthConfig appleOAuthConfig, JwksClient jwksClient) {
        this.appleOAuthConfig = appleOAuthConfig;
        this.keyCache =
                new JwksKeyCache(
                        "Apple",
                        () -> jwksClient.fetchJwks(appleOAuthConfig.getJwksUri(), "Apple"),
                        appleOAuthConfig.getKeyCacheTtl(),
                        appleOAuthConfig.getKeyRefreshMinInterval());
    }

    /**
     * Returns the Apple identity; its name is always {@code null} because Apple never puts the name
     * in the token (the app sends it separately on first sign-in).
     *
     * @throws FuelException 401 if the token is not a valid Apple identity token for this app, 503
     *     if Apple's keys can't be fetched
     */
    public OAuthIdentity verify(String identityToken) {

        final Claims claims;
        try {
            claims =
                    Jwts.parser()
                            .keyLocator(keyCache::locateKey)
                            .clockSkewSeconds(appleOAuthConfig.getClockSkew().toSeconds())
                            .build()
                            .parseSignedClaims(identityToken)
                            .getPayload();
        } catch (JwtException | IllegalArgumentException exception) {
            log.warn("Apple identity token rejected: {}", exception.getMessage());
            throw invalidToken();
        }

        validateClaims(claims);

        return new OAuthIdentity(
                AuthProvider.APPLE, claims.getSubject(), verifiedEmail(claims), null);
    }

    private void validateClaims(Claims claims) {

        if (claims.getExpiration() == null) {
            throw rejected("missing exp");
        }

        if (!appleOAuthConfig.getIssuer().equals(claims.getIssuer())) {
            throw rejected("unexpected issuer");
        }

        Set<String> audience = claims.getAudience();
        if (audience == null
                || audience.stream().noneMatch(appleOAuthConfig.getClientIds()::contains)) {
            throw rejected("audience is not one of our client ids");
        }

        if (isBlank(claims.getSubject())) {
            throw rejected("missing sub");
        }
    }

    private static String verifiedEmail(Claims claims) {
        String email = claims.get("email", String.class);
        // Apple sends email_verified as the string "true" in some tokens and a boolean in others.
        if (isBlank(email) || !"true".equals(String.valueOf(claims.get("email_verified")))) {
            return null;
        }
        return EmailNormalizer.normalize(email);
    }

    private FuelException rejected(String reason) {
        log.warn("Apple identity token rejected: {}", reason);
        return invalidToken();
    }

    private static FuelException invalidToken() {
        return new FuelException(HttpStatus.UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
