package com.lazybuff.fuel.config;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Per-client-IP rate limits for unauthenticated endpoints, keyed by a short rule name that is also
 * used in the Redis key (e.g. {@code login}).
 */
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit.per-ip")
@Getter
@Setter
public class IpRateLimitConfig {

    private Map<String, Rule> endpoints = new LinkedHashMap<>();

    @Getter
    @Setter
    public static class Rule {

        private String path;

        private int maxRequests;

        private Duration window;
    }
}
