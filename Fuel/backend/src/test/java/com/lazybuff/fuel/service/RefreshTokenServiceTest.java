package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.entity.RefreshToken;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.repository.RefreshTokenRepository;
import com.lazybuff.fuel.util.TokenHasher;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefreshTokenService")
class RefreshTokenServiceTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;

    // JwtConfig is a plain config holder; use a real instance so expiry maths is exercised.
    private final JwtConfig jwtConfig = TestDataFactory.jwtConfig();

    private RefreshTokenService refreshTokenService;

    @Captor private ArgumentCaptor<RefreshToken> refreshTokenCaptor;

    private User user;

    @BeforeEach
    void setUp() {
        refreshTokenService = new RefreshTokenService(refreshTokenRepository, jwtConfig);
        user = TestDataFactory.persistedUser();
    }

    @Nested
    @DisplayName("issueRefreshToken")
    class IssueRefreshToken {

        @Test
        @DisplayName("persists a hashed token and returns the raw token to the caller")
        void issuesAndPersistsToken() throws Exception {
            Instant before = Instant.now();

            String raw =
                    refreshTokenService.issueRefreshToken(
                            user, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS);

            Instant after = Instant.now();

            assertThat(raw).isNotBlank();

            verify(refreshTokenRepository).save(refreshTokenCaptor.capture());
            RefreshToken saved = refreshTokenCaptor.getValue();

            assertThat(saved.getUser()).isSameAs(user);
            assertThat(saved.getDeviceInfo()).isEqualTo(TestDataFactory.DEVICE_INFO);
            assertThat(saved.getIpAddress()).isEqualTo(TestDataFactory.IP_ADDRESS);
            // The stored value must be the hash of the raw token, never the raw token itself.
            assertThat(saved.getTokenHash())
                    .isEqualTo(TokenHasher.sha256Hex(raw))
                    .isNotEqualTo(raw);
            assertThat(saved.getExpiresAt())
                    .isBetween(
                            before.plusSeconds(TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS),
                            after.plusSeconds(TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS));
        }

        @Test
        @DisplayName("returns a fresh random raw token on each call")
        void issuesUniqueTokens() throws Exception {
            String first = refreshTokenService.issueRefreshToken(user, null, null);
            String second = refreshTokenService.issueRefreshToken(user, null, null);

            assertThat(first).isNotEqualTo(second);
            verify(refreshTokenRepository, org.mockito.Mockito.times(2))
                    .save(org.mockito.ArgumentMatchers.any(RefreshToken.class));
        }

        @Test
        @DisplayName("accepts null device/ip metadata and still persists the token")
        void issuesTokenWithNullMetadata() throws Exception {
            String raw = refreshTokenService.issueRefreshToken(user, null, null);

            assertThat(raw).isNotBlank();
            verify(refreshTokenRepository).save(refreshTokenCaptor.capture());
            RefreshToken saved = refreshTokenCaptor.getValue();
            assertThat(saved.getDeviceInfo()).isNull();
            assertThat(saved.getIpAddress()).isNull();
        }

        @Test
        @DisplayName("propagates persistence failures to the caller")
        void propagatesRepositoryFailure() {
            doThrow(new RuntimeException("db down"))
                    .when(refreshTokenRepository)
                    .save(org.mockito.ArgumentMatchers.any(RefreshToken.class));

            assertThatThrownBy(
                            () ->
                                    refreshTokenService.issueRefreshToken(
                                            user,
                                            TestDataFactory.DEVICE_INFO,
                                            TestDataFactory.IP_ADDRESS))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("db down");
        }
    }

    @Nested
    @DisplayName("revoke")
    class Revoke {

        @Test
        @DisplayName("deletes the token row matching the hash of the supplied raw token")
        void revokesByHash() throws Exception {
            String raw = "some-raw-refresh-token-value";

            refreshTokenService.revoke(raw);

            ArgumentCaptor<String> hashCaptor = ArgumentCaptor.forClass(String.class);
            verify(refreshTokenRepository).deleteByTokenHash(hashCaptor.capture());
            assertThat(hashCaptor.getValue()).isEqualTo(TokenHasher.sha256Hex(raw));
        }
    }

    @Nested
    @DisplayName("revokeForUser")
    class RevokeForUser {

        @Test
        @DisplayName("deletes only the token row matching both the hash and the user id")
        void revokesByHashAndUser() throws Exception {
            String raw = "some-raw-refresh-token-value";
            UUID userId = TestDataFactory.USER_ID;

            refreshTokenService.revokeForUser(raw, userId);

            ArgumentCaptor<String> hashCaptor = ArgumentCaptor.forClass(String.class);
            verify(refreshTokenRepository)
                    .deleteByTokenHashAndUser_Id(hashCaptor.capture(), org.mockito.Mockito.eq(userId));
            assertThat(hashCaptor.getValue()).isEqualTo(TokenHasher.sha256Hex(raw));
        }

        @Test
        @DisplayName("propagates repository failures to the caller")
        void propagatesRepositoryFailure() {
            String raw = "some-raw-refresh-token-value";
            UUID userId = TestDataFactory.USER_ID;
            doThrow(new RuntimeException("db down"))
                    .when(refreshTokenRepository)
                    .deleteByTokenHashAndUser_Id(org.mockito.ArgumentMatchers.anyString(), org.mockito.Mockito.eq(userId));

            assertThatThrownBy(() -> refreshTokenService.revokeForUser(raw, userId))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("db down");
        }
    }

    @Nested
    @DisplayName("revokeAll")
    class RevokeAll {

        @Test
        @DisplayName("deletes every token belonging to the given user id")
        void revokesAllForUser() {
            UUID userId = TestDataFactory.USER_ID;

            refreshTokenService.revokeAll(userId);

            verify(refreshTokenRepository).deleteByUser_Id(userId);
        }

        @Test
        @DisplayName("does not hash anything when revoking all tokens")
        void revokeAllTouchesOnlyBulkDelete() {
            refreshTokenService.revokeAll(TestDataFactory.USER_ID);

            verify(refreshTokenRepository).deleteByUser_Id(TestDataFactory.USER_ID);
            org.mockito.Mockito.verifyNoMoreInteractions(refreshTokenRepository);
        }
    }

    @Test
    @DisplayName("does not persist when no operation is invoked")
    void noInteractionsByDefault() {
        verifyNoInteractions(refreshTokenRepository);
    }
}
