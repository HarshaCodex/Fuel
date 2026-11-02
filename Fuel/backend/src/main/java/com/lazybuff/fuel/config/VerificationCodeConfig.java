package com.lazybuff.fuel.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for emailed email-verification and password-reset codes. */
@Configuration
@ConfigurationProperties(prefix = "app.verification-code")
@Getter
@Setter
public class VerificationCodeConfig {

    /**
     * Guesses allowed per code (wrong ones and the final right one) before it stops working. Codes
     * are only 5 digits, so without a cap they can be brute-forced within their lifetime.
     */
    private int maxAttempts = 5;

    /**
     * Base64 key (at least 32 bytes) for hashing stored codes; see {@code VerificationCodeHasher}.
     */
    private String secret;
}
