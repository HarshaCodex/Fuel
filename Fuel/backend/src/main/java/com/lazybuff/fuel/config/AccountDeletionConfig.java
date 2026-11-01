package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for {@code DELETE /api/user/account} and the purge of deleted accounts. */
@Configuration
@ConfigurationProperties(prefix = "app.account-deletion")
@Getter
@Setter
public class AccountDeletionConfig {

    /** How long a deleted account's data is kept before it is permanently purged. */
    private Duration retention = Duration.ofDays(30);

    /**
     * Confirmation attempts allowed per user per {@link #attemptWindow}. The endpoint checks the
     * password, so without a cap a stolen session could use it to guess the password.
     */
    private int maxAttempts = 5;

    private Duration attemptWindow = Duration.ofMinutes(15);
}
