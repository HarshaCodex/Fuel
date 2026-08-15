package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
@DisplayName("RateLimiterService")
class RateLimiterServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private RateLimiterService rateLimiterService;

    private static final String KEY = "rate_limit:resend-verification:user@example.com";
    private static final int LIMIT = 3;
    private static final Duration WINDOW = Duration.ofHours(1);

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
}
