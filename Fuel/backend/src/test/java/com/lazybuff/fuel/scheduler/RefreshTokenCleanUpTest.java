package com.lazybuff.fuel.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.lazybuff.fuel.repository.RefreshTokenRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefreshTokenCleanUp")
class RefreshTokenCleanUpTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;

    @Captor private ArgumentCaptor<Instant> cutoffCaptor;

    private RefreshTokenCleanUp refreshTokenCleanUp;

    @BeforeEach
    void setUp() {
        refreshTokenCleanUp = new RefreshTokenCleanUp(refreshTokenRepository);
    }

    @Test
    @DisplayName("purges tokens expired as of the current time")
    void purgesTokensExpiredAsOfNow() {
        Instant before = Instant.now();

        refreshTokenCleanUp.refreshTokenCleanup();

        Instant after = Instant.now();

        verify(refreshTokenRepository).deleteByExpiresAtBefore(cutoffCaptor.capture());
        assertThat(cutoffCaptor.getValue()).isBetween(before, after);
    }

    @Test
    @DisplayName("propagates repository failures to the caller")
    void propagatesRepositoryFailure() {
        doThrow(new RuntimeException("db down"))
                .when(refreshTokenRepository)
                .deleteByExpiresAtBefore(org.mockito.ArgumentMatchers.any(Instant.class));

        assertThatThrownBy(() -> refreshTokenCleanUp.refreshTokenCleanup())
                .isInstanceOf(RuntimeException.class)
                .hasMessage("db down");
    }
}
