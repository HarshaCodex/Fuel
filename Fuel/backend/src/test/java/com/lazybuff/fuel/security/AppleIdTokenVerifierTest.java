package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.AppleOAuthConfig;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.util.AuthProvider;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Jwks;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppleIdTokenVerifier")
class AppleIdTokenVerifierTest {

    private static final String BUNDLE_ID = "com.lazybuff.fuel";
    private static final String ISSUER = "https://appleid.apple.com";
    private static final String JWKS_URI = "https://appleid.apple.com/auth/keys";
    private static final String KID = "apple-key-1";
    private static final String SUBJECT = "001234.abcdef0123456789.1234";
    private static final String EMAIL = "x7k2abc@privaterelay.appleid.com";

    private static final KeyPair KEY_PAIR = Jwts.SIG.RS256.keyPair().build();
    private static final KeyPair OTHER_KEY_PAIR = Jwts.SIG.RS256.keyPair().build();

    @Mock private JwksClient jwksClient;

    private AppleIdTokenVerifier verifier;

    @BeforeEach
    void setUp() {
        AppleOAuthConfig config = new AppleOAuthConfig();
        config.setClientIds(List.of(BUNDLE_ID, "com.lazybuff.fuel.web"));
        config.setIssuer(ISSUER);
        config.setJwksUri(JWKS_URI);
        config.setKeyCacheTtl(Duration.ofHours(6));
        config.setKeyRefreshMinInterval(Duration.ofMinutes(1));
        config.setClockSkew(Duration.ofSeconds(60));
        verifier = new AppleIdTokenVerifier(config, jwksClient);
    }

    private static JwtBuilder validToken() {
        Instant now = Instant.now();
        return Jwts.builder()
                .header()
                .keyId(KID)
                .and()
                .issuer(ISSUER)
                .audience()
                .add(BUNDLE_ID)
                .and()
                .subject(SUBJECT)
                .claim("email", EMAIL)
                // Apple sends these as strings.
                .claim("email_verified", "true")
                .claim("is_private_email", "true")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(600)))
                .signWith(KEY_PAIR.getPrivate(), Jwts.SIG.RS256);
    }

    private void stubKeys() {
        String jwks =
                "{\"keys\":["
                        + Jwks.json(Jwks.builder().key(KEY_PAIR.getPublic()).id(KID).build())
                        + "]}";
        when(jwksClient.fetchJwks(JWKS_URI, "Apple")).thenReturn(jwks);
    }

    private void assertRejected(String token) {
        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(FuelException.class)
                .hasMessage("Invalid Apple identity token")
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("returns the Apple identity for a valid token, with no name")
    void shouldReturnIdentityForValidToken() {
        stubKeys();

        OAuthIdentity identity = verifier.verify(validToken().compact());

        assertThat(identity).isEqualTo(new OAuthIdentity(AuthProvider.APPLE, SUBJECT, EMAIL, null));
    }

    @Test
    @DisplayName("accepts email_verified sent as a boolean")
    void shouldAcceptBooleanEmailVerified() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().claim("email_verified", true).compact());

        assertThat(identity.email()).isEqualTo(EMAIL);
    }

    @Test
    @DisplayName("lower-cases the email")
    void shouldLowercaseEmail() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().claim("email", "Jane@iCloud.COM").compact());

        assertThat(identity.email()).isEqualTo("jane@icloud.com");
    }

    @Test
    @DisplayName("leaves the email out when the token has none")
    void shouldReturnNullEmailWhenAbsent() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(
                        validToken().claim("email", null).claim("email_verified", null).compact());

        assertThat(identity.subject()).isEqualTo(SUBJECT);
        assertThat(identity.email()).isNull();
    }

    @Test
    @DisplayName("leaves the email out when Apple has not verified it, so it can't be used to link")
    void shouldReturnNullEmailWhenUnverified() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().claim("email_verified", "false").compact());

        assertThat(identity.email()).isNull();
    }

    @Test
    @DisplayName("accepts any configured audience, e.g. the Services ID")
    void shouldAcceptOtherConfiguredAudience() {
        stubKeys();

        OAuthIdentity identity =
                verifier.verify(validToken().audience().single("com.lazybuff.fuel.web").compact());

        assertThat(identity.subject()).isEqualTo(SUBJECT);
    }

    @Test
    @DisplayName("rejects a token issued for another app")
    void shouldRejectWrongAudience() {
        stubKeys();

        assertRejected(validToken().audience().single("com.someone.else").compact());
    }

    @Test
    @DisplayName("rejects a token from another issuer")
    void shouldRejectWrongIssuer() {
        stubKeys();

        assertRejected(validToken().issuer("https://accounts.google.com").compact());
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
    @DisplayName("rejects a token without a subject")
    void shouldRejectTokenWithoutSubject() {
        stubKeys();

        assertRejected(validToken().subject(null).compact());
    }

    @Test
    @DisplayName("rejects a token signed by a different key under Apple's key id")
    void shouldRejectBadSignature() {
        stubKeys();

        assertRejected(validToken().signWith(OTHER_KEY_PAIR.getPrivate()).compact());
    }

    @Test
    @DisplayName("rejects an HMAC-signed token")
    void shouldRejectHmacToken() {
        assertRejected(
                validToken()
                        .signWith(
                                Keys.hmacShaKeyFor(
                                        "an-hmac-secret-that-is-at-least-32-bytes!!"
                                                .getBytes(StandardCharsets.UTF_8)))
                        .compact());
    }

    @Test
    @DisplayName("rejects malformed input")
    void shouldRejectMalformedToken() {
        assertRejected("not-a-jwt");
    }

    @Test
    @DisplayName("caches Apple's keys between verifications")
    void shouldCacheKeys() {
        stubKeys();

        verifier.verify(validToken().compact());
        verifier.verify(validToken().compact());

        verify(jwksClient, times(1)).fetchJwks(JWKS_URI, "Apple");
    }

    @Test
    @DisplayName("surfaces 503 when Apple's keys cannot be fetched")
    void shouldPropagateUnavailableWhenKeysCannotBeFetched() {
        when(jwksClient.fetchJwks(JWKS_URI, "Apple"))
                .thenThrow(new FuelException(HttpStatus.SERVICE_UNAVAILABLE, "Apple unavailable"));

        assertThatThrownBy(() -> verifier.verify(validToken().compact()))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
