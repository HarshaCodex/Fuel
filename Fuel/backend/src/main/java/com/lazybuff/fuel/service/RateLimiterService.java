package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.exception.RateLimitExceededException;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    @NoLogging
    public boolean isAllowed(String key, int limit, Duration window) {

        try {

            Long currentCount = redisTemplate.opsForValue().increment(key);

            if (currentCount == null) {
                return true;
            }

            if (currentCount == 1) {
                redisTemplate.expire(key, window);
            }

            return currentCount <= limit;
        } catch (Exception exception) {
            log.error("Exception occurred while calculating the rate limit: ", exception);
            return true;
        }
    }

    /**
     * Counts a hit against {@code key} and rejects it once more than {@code limit} hits land in the
     * current window. Fails open if Redis is unavailable, like {@link #isAllowed}.
     *
     * @throws RateLimitExceededException with the time left in the window
     */
    @NoLogging
    public void enforce(String key, int limit, Duration window, String message) {
        if (!isAllowed(key, limit, window)) {
            throw new RateLimitExceededException(message, retryAfter(key, window));
        }
    }

    private Duration retryAfter(String key, Duration window) {
        try {
            Long ttlSeconds = redisTemplate.getExpire(key, TimeUnit.SECONDS);

            if (ttlSeconds == null || ttlSeconds < 0) {
                // No TTL means the expire after the first hit never landed (e.g. a crash between
                // the two calls); without this the caller would be locked out permanently.
                redisTemplate.expire(key, window);
                return window;
            }
            return Duration.ofSeconds(Math.max(ttlSeconds, 1));

        } catch (Exception exception) {
            log.error("Exception occurred while reading the rate limit TTL: ", exception);
            return window;
        }
    }
}
