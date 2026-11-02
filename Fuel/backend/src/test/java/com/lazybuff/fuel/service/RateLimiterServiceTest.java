package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.exception.RateLimitExceededException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("RateLimiterService")
class RateLimiterServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private RateLimiterService rateLimiterService;

    private static final String KEY = "rate_limit:resend-verification:user@example.com";
    private static final int LIMIT = 3;
    private static final Duration WINDOW = Duration.ofHours(1);
    private static final String MESSAGE = "Too many requests. Please try again later.";

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterService(redisTemplate);
    }

    @Test
    @DisplayName("allows the first hit of a window and stamps its TTL")
    void allowsFirstHitAndSetsTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(1L);

        boolean allowed = rateLimiterService.isAllowed(KEY, LIMIT, WINDOW);

        assertThat(allowed).isTrue();
        verify(redisTemplate).expire(KEY, WINDOW);
    }

    @Test
    @DisplayName("allows a hit that reaches the limit without resetting the TTL")
    void allowsHitAtLimitWithoutResettingTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn((long) LIMIT);

        boolean allowed = rateLimiterService.isAllowed(KEY, LIMIT, WINDOW);

        assertThat(allowed).isTrue();
        // TTL is stamped only on the first hit (count == 1), never re-applied afterwards.
        verify(redisTemplate, never()).expire(eq(KEY), any(Duration.class));
    }

    @Test
    @DisplayName("denies a hit once the counter exceeds the limit")
    void deniesHitOverLimit() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(LIMIT + 1L);

        boolean allowed = rateLimiterService.isAllowed(KEY, LIMIT, WINDOW);

        assertThat(allowed).isFalse();
        verify(redisTemplate, never()).expire(eq(KEY), any(Duration.class));
    }

    @Test
    @DisplayName("allows the request when the counter comes back null")
    void allowsWhenIncrementReturnsNull() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(null);

        boolean allowed = rateLimiterService.isAllowed(KEY, LIMIT, WINDOW);

        // A null reply is treated as "no counter" and must not block the caller.
        assertThat(allowed).isTrue();
        verify(redisTemplate, never()).expire(eq(KEY), any(Duration.class));
    }

    @Test
    @DisplayName("fails open (allows) when Redis is unavailable")
    void failsOpenWhenRedisUnavailable() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY))
                .thenThrow(new RedisConnectionFailureException("redis down"));

        boolean allowed = rateLimiterService.isAllowed(KEY, LIMIT, WINDOW);

        // A cache outage must not lock users out of a legitimate action.
        assertThat(allowed).isTrue();
    }

    @Test
    @DisplayName("enforce lets a hit within the limit through")
    void enforceAllowsHitWithinLimit() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(1L);

        assertThatCode(() -> rateLimiterService.enforce(KEY, LIMIT, WINDOW, MESSAGE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("enforce rejects a hit over the limit with the time left in the window")
    void enforceRejectsHitOverLimitWithRemainingTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(LIMIT + 1L);
        when(redisTemplate.getExpire(KEY, TimeUnit.SECONDS)).thenReturn(42L);

        assertThatThrownBy(() -> rateLimiterService.enforce(KEY, LIMIT, WINDOW, MESSAGE))
                .isInstanceOfSatisfying(
                        RateLimitExceededException.class,
                        ex -> {
                            assertThat(ex.getHttpStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                            assertThat(ex.getMessage()).isEqualTo(MESSAGE);
                            assertThat(ex.getRetryAfter()).isEqualTo(Duration.ofSeconds(42));
                        });
    }

    @Test
    @DisplayName("enforce restores a missing TTL so the caller isn't locked out forever")
    void enforceRestoresMissingTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(LIMIT + 1L);
        when(redisTemplate.getExpire(KEY, TimeUnit.SECONDS)).thenReturn(-1L);

        assertThatThrownBy(() -> rateLimiterService.enforce(KEY, LIMIT, WINDOW, MESSAGE))
                .isInstanceOfSatisfying(
                        RateLimitExceededException.class,
                        ex -> assertThat(ex.getRetryAfter()).isEqualTo(WINDOW));
        verify(redisTemplate).expire(KEY, WINDOW);
    }

    @Test
    @DisplayName("enforce fails open when Redis is unavailable")
    void enforceFailsOpenWhenRedisUnavailable() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY))
                .thenThrow(new RedisConnectionFailureException("redis down"));

        assertThatCode(() -> rateLimiterService.enforce(KEY, LIMIT, WINDOW, MESSAGE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("reset deletes the counter")
    void resetDeletesCounter() {
        rateLimiterService.reset(KEY);

        verify(redisTemplate).delete(KEY);
    }

    @Test
    @DisplayName("reset does not throw when Redis is unavailable")
    void resetToleratesRedisFailure() {
        when(redisTemplate.delete(KEY))
                .thenThrow(new RedisConnectionFailureException("redis down"));

        assertThatCode(() -> rateLimiterService.reset(KEY)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("enforceNotReached lets a call through below the limit without counting it")
    void enforceNotReachedAllowsBelowLimit() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(KEY)).thenReturn(String.valueOf(LIMIT - 1));

        assertThatCode(() -> rateLimiterService.enforceNotReached(KEY, LIMIT, WINDOW, MESSAGE))
                .doesNotThrowAnyException();

        verify(valueOperations, never()).increment(any());
    }

    @Test
    @DisplayName("enforceNotReached lets a call through when nothing has been counted")
    void enforceNotReachedAllowsWithoutCounter() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(KEY)).thenReturn(null);

        assertThatCode(() -> rateLimiterService.enforceNotReached(KEY, LIMIT, WINDOW, MESSAGE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("enforceNotReached rejects once the limit is reached, with the time left")
    void enforceNotReachedRejectsAtLimit() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(KEY)).thenReturn(String.valueOf(LIMIT));
        when(redisTemplate.getExpire(KEY, TimeUnit.SECONDS)).thenReturn(90L);

        assertThatThrownBy(() -> rateLimiterService.enforceNotReached(KEY, LIMIT, WINDOW, MESSAGE))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessage(MESSAGE)
                .extracting(ex -> ((RateLimitExceededException) ex).getRetryAfter())
                .isEqualTo(Duration.ofSeconds(90));
    }

    @Test
    @DisplayName("enforceNotReached fails open when Redis is unavailable")
    void enforceNotReachedFailsOpen() {
        when(redisTemplate.opsForValue())
                .thenThrow(new RedisConnectionFailureException("redis down"));

        assertThatCode(() -> rateLimiterService.enforceNotReached(KEY, LIMIT, WINDOW, MESSAGE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("record counts a hit and starts the window on the first one")
    void recordCountsHit() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(KEY)).thenReturn(1L);

        rateLimiterService.record(KEY, WINDOW);

        verify(valueOperations).increment(KEY);
        verify(redisTemplate).expire(KEY, WINDOW);
    }
}
