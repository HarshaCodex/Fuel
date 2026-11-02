package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for purging sign-ups whose email was never verified (#89). */
@Configuration
@ConfigurationProperties(prefix = "app.unverified-account")
@Getter
@Setter
public class UnverifiedAccountConfig {

    /**
     * How long an unverified account is kept. Such accounts can't sign in, so this only bounds how
     * long data from a sign-up nobody completed (possibly with someone else's email) is stored.
     */
    private Duration retention = Duration.ofDays(7);
}
