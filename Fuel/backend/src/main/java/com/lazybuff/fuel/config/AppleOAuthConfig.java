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

    /*
     * Credentials for calling Apple's REST API (token exchange and revocation, #81). Leave unset
     * until the Apple Developer key exists; revocation is then skipped with a warning.
     */

    /** Apple Developer Team ID; the {@code iss} of the client secret. */
    private String teamId;

    /** ID of the Sign in with Apple key; the {@code kid} of the client secret. */
    private String keyId;

    /** Contents of the key's {@code .p8} file (PKCS#8 PEM). A secret: env var / secret manager. */
    private String privateKey;

    private String tokenUri;

    private String revokeUri;

    /** Lifetime of each generated client secret; it's only used for a couple of calls. */
    private Duration clientSecretTtl;

    /** Whether the API credentials are set, i.e. Apple's REST API can be called. */
    public boolean hasApiCredentials() {
        return isSet(teamId) && isSet(keyId) && isSet(privateKey);
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }
}
