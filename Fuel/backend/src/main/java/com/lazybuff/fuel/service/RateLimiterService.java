package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import java.time.Duration;
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
}
