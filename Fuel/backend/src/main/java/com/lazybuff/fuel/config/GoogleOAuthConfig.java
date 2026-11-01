package com.lazybuff.fuel.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for verifying Google Sign-In ID tokens issued to the Fuel mobile/web clients. */
@Configuration
@ConfigurationProperties(prefix = "app.oauth.google")
@Getter
@Setter
public class GoogleOAuthConfig {

    /** OAuth client IDs (iOS, Android, web) whose ID tokens are accepted as the {@code aud}. */
    private List<String> clientIds = new ArrayList<>();

    private String jwksUri;

    private List<String> issuers = new ArrayList<>();

    /** How long Google's signing keys are trusted before being re-fetched. */
    private Duration keyCacheTtl;

    /**
     * Floor between re-fetches triggered by an unknown key id, so forged kids can't hammer Google.
     */
    private Duration keyRefreshMinInterval;

    private Duration clockSkew;
}
