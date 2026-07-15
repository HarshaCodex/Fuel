package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lazybuff.fuel.config.JwtConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.security.SignatureException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@DisplayName("JwtService")
class JwtServiceTest {

    private JwtConfig jwtConfig;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtConfig = TestDataFactory.jwtConfig();
        jwtService = new JwtService(jwtConfig);
    }

    @Nested
    @DisplayName("generateToken")
    class GenerateToken {

        @Test
        @DisplayName("produces a token whose claims match the supplied user id and email")
        void generatesTokenWithExpectedClaims() {
            long before = System.currentTimeMillis();

            String token =
                    jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL);

            long after = System.currentTimeMillis();

            assertThat(token).isNotBlank();
            // A signed JWT is three base64url segments separated by dots.
            assertThat(token.split("\\.")).hasSize(3);

            Claims claims = jwtService.parseAndValidate(token).getPayload();
            assertThat(claims.getSubject()).isEqualTo(TestDataFactory.USER_ID.toString());
            assertThat(claims.get("email", String.class)).isEqualTo(TestDataFactory.EMAIL);
            assertThat(claims.getIssuedAt()).isNotNull();
            // JWT exp is stored at whole-second precision, so allow a 1s slack on the lower bound.
            long expiryMillis = TestDataFactory.ACCESS_TOKEN_EXPIRY_SECONDS * 1000L;
            assertThat(claims.getExpiration())
                    .isAfterOrEqualTo(new Date(before + expiryMillis - 1000L))
                    .isBeforeOrEqualTo(new Date(after + expiryMillis));
        }

        @Test
        @DisplayName("issues distinct tokens for different users")
        void generatesDistinctTokensPerUser() {
            String tokenOne = jwtService.generateToken("user-one", "one@example.com");
            String tokenTwo = jwtService.generateToken("user-two", "two@example.com");

            assertThat(tokenOne).isNotEqualTo(tokenTwo);
            assertThat(jwtService.parseAndValidate(tokenOne).getPayload().getSubject())
                    .isEqualTo("user-one");
            assertThat(jwtService.parseAndValidate(tokenTwo).getPayload().getSubject())
                    .isEqualTo("user-two");
        }
    }

    @Nested
    @DisplayName("parseAndValidate")
    class ParseAndValidate {

        @Test
        @DisplayName("round-trips a freshly generated token")
        void parsesValidToken() {
            String token =
                    jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL);

            Jws<Claims> parsed = jwtService.parseAndValidate(token);

            assertThat(parsed.getPayload().getSubject())
                    .isEqualTo(TestDataFactory.USER_ID.toString());
            assertThat(parsed.getPayload().get("email", String.class))
                    .isEqualTo(TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("rejects a malformed token string")
        void rejectsMalformedToken() {
            assertThatThrownBy(() -> jwtService.parseAndValidate("not-a-real-jwt"))
                    .isInstanceOf(io.jsonwebtoken.JwtException.class);
        }

        @Test
        @DisplayName("rejects a token whose signature was tampered with")
        void rejectsTamperedSignature() {
            String token =
                    jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL);
            // Flip the signature segment while keeping header/payload intact.
            String[] parts = token.split("\\.");
            String tampered = parts[0] + "." + parts[1] + "." + parts[2] + "abc";

            assertThatThrownBy(() -> jwtService.parseAndValidate(tampered))
                    .isInstanceOf(SignatureException.class);
        }

        @Test
        @DisplayName("rejects a token signed with a different secret")
        void rejectsTokenSignedWithDifferentKey() {
            String otherSecret =
                    Base64.getEncoder()
                            .encodeToString(
                                    "a-totally-different-secret-key-used-by-an-attacker-value!!"
                                            .getBytes(StandardCharsets.UTF_8));
            JwtService foreignService =
                    new JwtService(
                            TestDataFactory.jwtConfig(
                                    otherSecret,
                                    TestDataFactory.ACCESS_TOKEN_EXPIRY_SECONDS,
                                    TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS));
            String foreignToken = foreignService.generateToken("intruder", "intruder@example.com");

            assertThatThrownBy(() -> jwtService.parseAndValidate(foreignToken))
                    .isInstanceOf(SignatureException.class);
        }

        @Test
        @DisplayName("rejects an expired token")
        void rejectsExpiredToken() {
            // Negative expiry pushes the expiration timestamp into the past on generation.
            JwtService expiringService =
                    new JwtService(
                            TestDataFactory.jwtConfig(
                                    TestDataFactory.JWT_SECRET,
                                    -60_000L,
                                    TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS));
            String expiredToken = expiringService.generateToken("user", "user@example.com");

            assertThatThrownBy(() -> jwtService.parseAndValidate(expiredToken))
                    .isInstanceOf(io.jsonwebtoken.ExpiredJwtException.class);
        }
    }
}
