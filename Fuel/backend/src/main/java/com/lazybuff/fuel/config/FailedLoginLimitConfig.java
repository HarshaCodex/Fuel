package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Per-account cap on failed password logins (#87). The per-IP limit alone lets an attacker who
 * spreads guesses over many IPs keep trying one account indefinitely.
 */
@Configuration
@ConfigurationProperties(prefix = "app.rate-limit.failed-login")
@Getter
@Setter
public class FailedLoginLimitConfig {

    /** Failed logins allowed per email per {@link #window}; further attempts get 429. */
    private int maxFailures = 10;

    private Duration window = Duration.ofMinutes(15);
}
