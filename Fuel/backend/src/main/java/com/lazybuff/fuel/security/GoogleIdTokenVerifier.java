package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.GoogleOAuthConfig;
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
 * Verifies Google Sign-In ID tokens locally against Google's published RSA keys.
 *
 * <p>Checks signature (RS256 only), expiry, issuer, audience (one of our client IDs) and that
 * Google has verified the email. Google's keys are cached by {@link JwksKeyCache}.
 */
@Component
@Slf4j
public class GoogleIdTokenVerifier {

    private static final String INVALID_TOKEN_MESSAGE = "Invalid Google ID token";

    private final GoogleOAuthConfig googleOAuthConfig;

    private final JwksKeyCache keyCache;

    public GoogleIdTokenVerifier(GoogleOAuthConfig googleOAuthConfig, JwksClient jwksClient) {
        this.googleOAuthConfig = googleOAuthConfig;
        this.keyCache =
                new JwksKeyCache(
                        "Google",
                        () -> jwksClient.fetchJwks(googleOAuthConfig.getJwksUri(), "Google"),
                        googleOAuthConfig.getKeyCacheTtl(),
                        googleOAuthConfig.getKeyRefreshMinInterval());
    }

    /**
     * @throws FuelException 401 if the token is not a valid Google ID token for this app, 503 if
     *     Google's keys can't be fetched
     */
    public OAuthIdentity verify(String idToken) {

        final Claims claims;
        try {
            claims =
                    Jwts.parser()
                            .keyLocator(keyCache::locateKey)
                            .clockSkewSeconds(googleOAuthConfig.getClockSkew().toSeconds())
                            .build()
                            .parseSignedClaims(idToken)
                            .getPayload();
        } catch (JwtException | IllegalArgumentException exception) {
            log.warn("Google ID token rejected: {}", exception.getMessage());
            throw invalidToken();
        }

        validateClaims(claims);

        return new OAuthIdentity(
                AuthProvider.GOOGLE,
                claims.getSubject(),
                EmailNormalizer.normalize(claims.get("email", String.class)),
                claims.get("name", String.class));
    }

    private void validateClaims(Claims claims) {

        if (claims.getExpiration() == null) {
            throw rejected("missing exp");
        }

        if (!googleOAuthConfig.getIssuers().contains(claims.getIssuer())) {
            throw rejected("unexpected issuer");
        }

        Set<String> audience = claims.getAudience();
        if (audience == null
                || audience.stream().noneMatch(googleOAuthConfig.getClientIds()::contains)) {
            throw rejected("audience is not one of our client ids");
        }

        if (isBlank(claims.getSubject()) || isBlank(claims.get("email", String.class))) {
            throw rejected("missing sub or email");
        }

        // Google encodes this as a boolean today but historically sent the string "true".
        if (!"true".equals(String.valueOf(claims.get("email_verified")))) {
            throw rejected("email not verified by Google");
        }
    }

    private FuelException rejected(String reason) {
        log.warn("Google ID token rejected: {}", reason);
        return invalidToken();
    }

    private static FuelException invalidToken() {
        return new FuelException(HttpStatus.UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
