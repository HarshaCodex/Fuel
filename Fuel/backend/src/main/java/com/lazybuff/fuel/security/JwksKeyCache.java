package com.lazybuff.fuel.security;

import io.jsonwebtoken.Header;
import io.jsonwebtoken.ProtectedHeader;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import java.security.Key;
import java.security.PublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Caches one OAuth provider's RSA signing keys and resolves the key for a token's {@code kid}.
 *
 * <p>Use {@link #locateKey} as a jjwt key locator. Only RS256 tokens are accepted, which also
 * blocks algorithm-confusion attacks (e.g. HMAC tokens signed with the public key). Keys are
 * re-fetched when the cache is older than {@code keyCacheTtl}, or when a token names an unknown
 * {@code kid} (providers rotate keys), but no more often than {@code keyRefreshMinInterval} so
 * forged kids can't hammer the provider.
 */
@Slf4j
public class JwksKeyCache {

    private static final String RS256 = "RS256";

    private final String providerName;

    private final Supplier<String> jwksFetcher;

    private final Duration keyCacheTtl;

    private final Duration keyRefreshMinInterval;

    private volatile Map<String, PublicKey> signingKeys = Map.of();

    private volatile Instant keysFetchedAt = Instant.EPOCH;

    /**
     * @param providerName used in log messages only
     * @param jwksFetcher returns the provider's JWK Set JSON; may throw to signal it's unreachable
     */
    public JwksKeyCache(
            String providerName,
            Supplier<String> jwksFetcher,
            Duration keyCacheTtl,
            Duration keyRefreshMinInterval) {
        this.providerName = providerName;
        this.jwksFetcher = jwksFetcher;
        this.keyCacheTtl = keyCacheTtl;
        this.keyRefreshMinInterval = keyRefreshMinInterval;
    }

    /**
     * Returns the public key named by the token header.
     *
     * @throws UnsupportedJwtException if the token isn't RS256, has no {@code kid}, or names a key
     *     the provider doesn't publish
     */
    public Key locateKey(Header header) {

        if (!(header instanceof ProtectedHeader protectedHeader)
                || !RS256.equals(protectedHeader.getAlgorithm())) {
            throw new UnsupportedJwtException("Only RS256-signed tokens are accepted");
        }

        String keyId = protectedHeader.getKeyId();
        if (keyId == null) {
            throw new UnsupportedJwtException("Missing key id");
        }

        Instant now = Instant.now();
        if (now.isAfter(keysFetchedAt.plus(keyCacheTtl))) {
            refreshKeys();
        }

        PublicKey key = signingKeys.get(keyId);
        if (key == null && now.isAfter(keysFetchedAt.plus(keyRefreshMinInterval))) {
            refreshKeys();
            key = signingKeys.get(keyId);
        }

        if (key == null) {
            throw new UnsupportedJwtException("Unknown key id");
        }
        return key;
    }

    private synchronized void refreshKeys() {

        JwkSet jwkSet = Jwks.setParser().build().parse(jwksFetcher.get());

        Map<String, PublicKey> keys = new HashMap<>();
        for (Jwk<?> jwk : jwkSet.getKeys()) {
            if (jwk.getId() != null && jwk.toKey() instanceof PublicKey publicKey) {
                keys.put(jwk.getId(), publicKey);
            }
        }

        signingKeys = Map.copyOf(keys);
        keysFetchedAt = Instant.now();
        log.info("Loaded {} {} signing keys", keys.size(), providerName);
    }
}
