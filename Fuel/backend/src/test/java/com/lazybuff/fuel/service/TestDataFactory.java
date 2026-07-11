package com.lazybuff.fuel.service;

import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.entity.RefreshToken;
import com.lazybuff.fuel.entity.User;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Central place that builds the fixtures shared across every service test so individual test
 * methods only tweak the field(s) they actually care about instead of re-assembling entities/DTOs.
 */
final class TestDataFactory {

    private TestDataFactory() {}

    // A >= 256-bit key (Base64 of a 60 byte string) so Keys.hmacShaKeyFor accepts it.
    static final String JWT_SECRET =
            Base64.getEncoder()
                    .encodeToString(
                            "this-is-a-very-long-and-secure-jwt-signing-secret-for-tests!!"
                                    .getBytes(StandardCharsets.UTF_8));

    // NOTE: JwtService adds accessTokenExpirySeconds directly onto millis, so this value is treated
    // as milliseconds by the code under test. Keep it large enough to stay valid during a test run.
    static final long ACCESS_TOKEN_EXPIRY = 3_600_000L;
    static final long REFRESH_TOKEN_EXPIRY_SECONDS = 604_800L; // 7 days

    static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final String EMAIL = "john.doe@example.com";
    static final String NAME = "John Doe";
    static final String RAW_PASSWORD = "Password1!";
    static final String HASHED_PASSWORD = "$2a$10$hashedpasswordvalueforunittesting123456789";
    static final String DEVICE_INFO = "iPhone 15 / iOS 18";
    static final String IP_ADDRESS = "203.0.113.42";

    static JwtConfig jwtConfig() {
        return jwtConfig(JWT_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_SECONDS);
    }

    static JwtConfig jwtConfig(String secret, long accessExpiry, long refreshExpiry) {
        JwtConfig config = new JwtConfig();
        config.setSecret(secret);
        config.setAccessTokenExpirySeconds(accessExpiry);
        config.setRefreshTokenExpirySeconds(refreshExpiry);
        return config;
    }

    /** A persisted user: has an id, mirroring what the repository returns after save. */
    static User persistedUser() {
        return User.builder()
                .id(USER_ID)
                .email(EMAIL)
                .name(NAME)
                .emailVerified(false)
                .timezone("UTC")
                .build();
    }

    static UserRegisterRequest registerRequest() {
        return UserRegisterRequest.builder().email(EMAIL).password(RAW_PASSWORD).name(NAME).build();
    }

    static RefreshToken refreshToken(User user) {
        return RefreshToken.builder()
                .id(UUID.randomUUID())
                .user(user)
                .tokenHash("existing-hash")
                .expiresAt(Instant.now().plusSeconds(REFRESH_TOKEN_EXPIRY_SECONDS))
                .deviceInfo(DEVICE_INFO)
                .ipAddress(IP_ADDRESS)
                .build();
    }
}
