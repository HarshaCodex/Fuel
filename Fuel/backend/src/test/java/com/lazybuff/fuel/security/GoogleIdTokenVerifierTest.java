package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.GoogleOAuthConfig;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.util.AuthProvider;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Jwks;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.PublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleIdTokenVerifier")
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "ios-client.apps.googleusercontent.com";
    private static final String ISSUER = "https://accounts.google.com";
    private static final String KID = "key-1";
    private static final String SUBJECT = "109876543210";
    private static final String EMAIL = "jane@gmail.com";
    private static final String NAME = "Jane Doe";
    private static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";

    private static final KeyPair KEY_PAIR = Jwts.SIG.RS256.keyPair().build();
    private static final KeyPair ROTATED_KEY_PAIR = Jwts.SIG.RS256.keyPair().build();

    @Mock private JwksClient jwksClient;

    private GoogleOAuthConfig config;

    private GoogleIdTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        config = new GoogleOAuthConfig();
        config.setClientIds(List.of("android-client.apps.googleusercontent.com", CLIENT_ID));
        config.setIssuers(List.of(ISSUER, "accounts.google.com"));
        config.setKeyCacheTtl(Duration.ofHours(6));
        config.setKeyRefreshMinInterval(Duration.ofMinutes(1));
        config.setClockSkew(Duration.ofSeconds(60));
        config.setJwksUri(JWKS_URI);
        verifier = new GoogleIdTokenVerifier(config, jwksClient);
    }

    private static String jwks(Map<String, PublicKey> keysById) {
        return keysById.entrySet().stream()
                .map(e -> Jwks.json(Jwks.builder().key(e.getValue()).id(e.getKey()).build()))
                .collect(Collectors.joining(",", "{\"keys\":[", "]}"));
    }

    private static JwtBuilder validToken() {
        Instant now = Instant.now();
        return Jwts.builder()
                .header()
                .keyId(KID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(CLIENT_ID)
                .and()
                .subject(SUBJECT)
                .claim("email", EMAIL)
                .claim("email_verified", true)
                .claim("name", NAME)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .signWith(KEY_PAIR.getPrivate(), Jwts.SIG.RS256);
    }

    private void stubKeys() {
        when(jwksClient.fetchJwks(JWKS_URI, "Google"))
                .thenReturn(jwks(Map.of(KID, KEY_PAIR.getPublic())));
    }

    private void assertRejected(String token) {
        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("returns the identity for a valid token")
    void shouldReturnIdentityForValidToken() {
        stubKeys();

        OAuthIdentity identity = verifier.verify(validToken().compact());

        assertThat(identity)
                .isEqualTo(new OAuthIdentity(AuthProvider.GOOGLE, SUBJECT, EMAIL, NAME));
    }

    @Test
    @DisplayName("accepts email_verified sent as the string \"true\"")
    void shouldAcceptStringEmailVerified() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().claim("email_verified", "true").compact());

        assertThat(identity.email()).isEqualTo(EMAIL);
    }

    @Test
    @DisplayName("lower-cases the email so it matches accounts registered in any case")
    void shouldLowercaseEmail() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().claim("email", "Jane@Gmail.COM").compact());

        assertThat(identity.email()).isEqualTo(EMAIL);
    }

    @Test
    @DisplayName("rejects a token issued for another app's client id")
    void shouldRejectWrongAudience() {
        stubKeys();

        assertRejected(
                validToken()
                        .audience()
                        .single("someone-else.apps.googleusercontent.com")
                        .compact());
    }

    @Test
    @DisplayName("rejects a token from an unexpected issuer")
    void shouldRejectWrongIssuer() {
        stubKeys();

        assertRejected(validToken().issuer("https://evil.example.com").compact());
    }

    @Test
    @DisplayName("rejects an expired token")
    void shouldRejectExpiredToken() {
        stubKeys();

        assertRejected(
                validToken().expiration(Date.from(Instant.now().minusSeconds(600))).compact());
    }

    @Test
    @DisplayName("rejects a token without an expiry")
    void shouldRejectTokenWithoutExpiry() {
        stubKeys();

        assertRejected(validToken().expiration(null).compact());
    }

    @Test
    @DisplayName("rejects a token whose email Google has not verified")
    void shouldRejectUnverifiedEmail() {
        stubKeys();

        assertRejected(validToken().claim("email_verified", false).compact());
    }

    @Test
    @DisplayName("rejects a token signed by a different key under a known key id")
    void shouldRejectBadSignature() {
        stubKeys();

        assertRejected(validToken().signWith(ROTATED_KEY_PAIR.getPrivate()).compact());
    }

    @Test
    @DisplayName("rejects an HMAC-signed token")
    void shouldRejectHmacToken() {
        String token =
                validToken()
                        .signWith(
                                Keys.hmacShaKeyFor(
                                        "an-hmac-secret-that-is-at-least-32-bytes!!"
                                                .getBytes(StandardCharsets.UTF_8)))
                        .compact();

        assertRejected(token);
    }

    @Test
    @DisplayName("rejects malformed input")
    void shouldRejectMalformedToken() {
        assertRejected("not-a-jwt");
    }

    @Test
    @DisplayName("caches Google's keys between verifications")
    void shouldCacheKeys() {
        stubKeys();

        verifier.verify(validToken().compact());
        verifier.verify(validToken().compact());

        verify(jwksClient, times(1)).fetchJwks(JWKS_URI, "Google");
    }

    @Test
    @DisplayName("re-fetches keys when Google rotates to an unknown key id")
    void shouldRefetchKeysOnUnknownKeyId() {
        config.setKeyRefreshMinInterval(Duration.ZERO);
        verifier = new GoogleIdTokenVerifier(config, jwksClient);
        when(jwksClient.fetchJwks(JWKS_URI, "Google"))
                .thenReturn(jwks(Map.of(KID, KEY_PAIR.getPublic())))
                .thenReturn(
                        jwks(
                                Map.of(
                                        KID,
                                        KEY_PAIR.getPublic(),
                                        "key-2",
                                        ROTATED_KEY_PAIR.getPublic())));
        verifier.verify(validToken().compact());

        OAuthIdentity identity =
                verifier.verify(
                        validToken()
                                .header()
                                .keyId("key-2")
                                .and()
                                .signWith(ROTATED_KEY_PAIR.getPrivate())
                                .compact());

        assertThat(identity.subject()).isEqualTo(SUBJECT);
        verify(jwksClient, times(2)).fetchJwks(JWKS_URI, "Google");
    }

    @Test
    @DisplayName("does not re-fetch keys for unknown key ids within the minimum interval")
    void shouldThrottleRefetchOnUnknownKeyId() {
        stubKeys();
        verifier.verify(validToken().compact());

        assertRejected(validToken().header().keyId("forged-kid").and().compact());

        verify(jwksClient, times(1)).fetchJwks(JWKS_URI, "Google");
    }

    @Test
    @DisplayName("surfaces 503 when Google's keys cannot be fetched")
    void shouldPropagateUnavailableWhenKeysCannotBeFetched() {
        when(jwksClient.fetchJwks(JWKS_URI, "Google"))
                .thenThrow(new FuelException(HttpStatus.SERVICE_UNAVAILABLE, "Google unavailable"));

        assertThatThrownBy(() -> verifier.verify(validToken().compact()))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
