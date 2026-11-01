package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.GoogleOAuthConfig;
import com.lazybuff.fuel.exception.FuelException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Header;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.ProtectedHeader;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import java.security.Key;
import java.security.PublicKey;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Verifies Google Sign-In ID tokens locally against Google's published RSA keys.
 *
 * <p>Checks signature (RS256 only), expiry, issuer, audience (one of our client IDs) and that
 * Google has verified the email. Keys are cached and re-fetched on TTL expiry or when a token
 * references an unknown key id (Google rotates keys regularly).
 */
@Component
@Slf4j
public class GoogleIdTokenVerifier {

    private static final String RS256 = "RS256";

    private static final String INVALID_TOKEN_MESSAGE = "Invalid Google ID token";

    private final GoogleOAuthConfig googleOAuthConfig;

    private final GoogleJwksClient googleJwksClient;

    private volatile Map<String, PublicKey> signingKeys = Map.of();

    private volatile Instant keysFetchedAt = Instant.EPOCH;

    public GoogleIdTokenVerifier(
            GoogleOAuthConfig googleOAuthConfig, GoogleJwksClient googleJwksClient) {
        this.googleOAuthConfig = googleOAuthConfig;
        this.googleJwksClient = googleJwksClient;
    }

    /**
     * @throws FuelException 401 if the token is not a valid Google ID token for this app, 503 if
     *     Google's keys can't be fetched
     */
    public GoogleIdentity verify(String idToken) {

        final Claims claims;
        try {
            claims =
                    Jwts.parser()
                            .keyLocator(this::locateKey)
                            .clockSkewSeconds(googleOAuthConfig.getClockSkew().toSeconds())
                            .build()
                            .parseSignedClaims(idToken)
                            .getPayload();
        } catch (JwtException | IllegalArgumentException exception) {
            log.warn("Google ID token rejected: {}", exception.getMessage());
            throw invalidToken();
        }

        validateClaims(claims);

        return new GoogleIdentity(
                claims.getSubject(),
                claims.get("email", String.class),
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

    private Key locateKey(Header header) {

        if (!(header instanceof ProtectedHeader protectedHeader)
                || !RS256.equals(protectedHeader.getAlgorithm())) {
            throw new UnsupportedJwtException("Only RS256-signed tokens are accepted");
        }

        String keyId = protectedHeader.getKeyId();
        if (keyId == null) {
            throw new UnsupportedJwtException("Missing key id");
        }

        Instant now = Instant.now();
        if (now.isAfter(keysFetchedAt.plus(googleOAuthConfig.getKeyCacheTtl()))) {
            refreshKeys();
        }

        PublicKey key = signingKeys.get(keyId);
        if (key == null
                && now.isAfter(keysFetchedAt.plus(googleOAuthConfig.getKeyRefreshMinInterval()))) {
            refreshKeys();
            key = signingKeys.get(keyId);
        }

        if (key == null) {
            throw new UnsupportedJwtException("Unknown key id");
        }
        return key;
    }

    private synchronized void refreshKeys() {

        JwkSet jwkSet = Jwks.setParser().build().parse(googleJwksClient.fetchJwks());

        Map<String, PublicKey> keys = new HashMap<>();
        for (Jwk<?> jwk : jwkSet.getKeys()) {
            if (jwk.getId() != null && jwk.toKey() instanceof PublicKey publicKey) {
                keys.put(jwk.getId(), publicKey);
            }
        }

        signingKeys = Map.copyOf(keys);
        keysFetchedAt = Instant.now();
        log.info("Loaded {} Google signing keys", keys.size());
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
