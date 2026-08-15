package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app.rate-limit.resend-verification")
@Getter
@Setter
public class RateLimitConfig {

    private int maxRequests;
    private Duration window;
}
