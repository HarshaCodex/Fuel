package com.lazybuff.fuel.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for verifying Sign in with Apple identity tokens issued to the Fuel apps. */
@Configuration
@ConfigurationProperties(prefix = "app.oauth.apple")
@Getter
@Setter
public class AppleOAuthConfig {

    /**
     * Accepted {@code aud} values: the iOS app's bundle ID, plus the Services ID used by
     * Android/web sign-in.
     */
    private List<String> clientIds = new ArrayList<>();

    private String jwksUri;

    private String issuer;

    /** How long Apple's signing keys are trusted before being re-fetched. */
    private Duration keyCacheTtl;

    /**
     * Floor between re-fetches triggered by an unknown key id, so forged kids can't hammer Apple.
     */
    private Duration keyRefreshMinInterval;

    private Duration clockSkew;
}
