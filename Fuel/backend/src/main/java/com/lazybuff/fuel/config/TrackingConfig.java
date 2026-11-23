package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for {@code POST /api/tracking/entries}. */
@Configuration
@ConfigurationProperties(prefix = "app.tracking")
@Getter
@Setter
public class TrackingConfig {

    /** How far after the current time an entry may be dated; allows for clock and timezone skew. */
    private Duration maxFutureLog = Duration.ofHours(24);
}
