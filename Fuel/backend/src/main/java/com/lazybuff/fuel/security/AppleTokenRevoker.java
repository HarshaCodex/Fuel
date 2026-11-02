package com.lazybuff.fuel.security;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.lazybuff.fuel.config.AppleOAuthConfig;
import io.jsonwebtoken.Jwts;
import java.net.http.HttpClient;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Revokes a user's Sign in with Apple tokens, as Apple requires when an account is deleted.
 *
 * <p>Apple only revokes tokens it issued to us, so the app sends a fresh authorization code with
 * the delete request. It is exchanged for a refresh token, which is then revoked. Both calls are
 * authenticated with a short-lived client secret: an ES256 JWT signed with our Apple Developer key.
 *
 * <p>Revocation is best-effort: failures (and missing credentials) are logged and never stop the
 * account from being deleted. Codes, tokens and the key are never logged.
 */
@Component
@Slf4j
public class AppleTokenRevoker {

    private static final String APPLE_AUDIENCE = "https://appleid.apple.com";

    private final AppleOAuthConfig appleOAuthConfig;

    private final RestClient restClient;

    private final PrivateKey signingKey;

    @Autowired
    public AppleTokenRevoker(
            AppleOAuthConfig appleOAuthConfig,
            @Value("${app.oauth.http-timeout}") Duration httpTimeout) {
        this(appleOAuthConfig, RestClient.builder().requestFactory(requestFactory(httpTimeout)));
    }

    /** Visible for tests, which bind a mock server to the builder. */
    AppleTokenRevoker(AppleOAuthConfig appleOAuthConfig, RestClient.Builder restClientBuilder) {
        this.appleOAuthConfig = appleOAuthConfig;
        this.restClient = restClientBuilder.build();
        // Parsed up front so a malformed key fails at startup rather than on the first deletion.
        this.signingKey =
                appleOAuthConfig.hasApiCredentials()
                        ? parsePrivateKey(appleOAuthConfig.getPrivateKey())
                        : null;
        if (signingKey == null) {
            log.warn("Apple API credentials not configured; Apple tokens won't be revoked");
        }
    }

    /**
     * Revokes the tokens behind {@code authorizationCode}. Never throws.
     *
     * @param clientId the client ID the code was issued to (the identity token's audience)
     */
    public void revoke(String authorizationCode, String clientId) {

        if (signingKey == null) {
            log.warn("Skipping Apple token revocation: API credentials not configured");
            return;
        }

        try {
            String clientSecret = clientSecret(clientId);

            AppleTokenResponse tokens =
                    post(
                                    appleOAuthConfig.getTokenUri(),
                                    form(
                                            clientId,
                                            clientSecret,
                                            "grant_type",
                                            "authorization_code",
                                            "code",
                                            authorizationCode))
                            .body(AppleTokenResponse.class);

            if (tokens == null || (tokens.refreshToken() == null && tokens.accessToken() == null)) {
                log.error("Apple token exchange returned no token; nothing to revoke");
                return;
            }
            boolean hasRefreshToken = tokens.refreshToken() != null;
            String token = hasRefreshToken ? tokens.refreshToken() : tokens.accessToken();

            post(
                            appleOAuthConfig.getRevokeUri(),
                            form(
                                    clientId,
                                    clientSecret,
                                    "token",
                                    token,
                                    "token_type_hint",
                                    hasRefreshToken ? "refresh_token" : "access_token"))
                    .toBodilessEntity();

            log.info("Revoked Apple tokens for client {}", clientId);

        } catch (RuntimeException exception) {
            // Message only, no stack trace, so the request (code, client secret) can't leak.
            log.error(
                    "Failed to revoke Apple tokens: {}: {}",
                    exception.getClass().getSimpleName(),
                    exception.getMessage());
        }
    }

    private RestClient.ResponseSpec post(String uri, MultiValueMap<String, String> form) {
        return restClient
                .post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve();
    }

    private static MultiValueMap<String, String> form(
            String clientId, String clientSecret, String... extraPairs) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        for (int i = 0; i < extraPairs.length; i += 2) {
            form.add(extraPairs[i], extraPairs[i + 1]);
        }
        return form;
    }

    private String clientSecret(String clientId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .header()
                .keyId(appleOAuthConfig.getKeyId())
                .and()
                .issuer(appleOAuthConfig.getTeamId())
                .subject(clientId)
                .audience()
                .add(APPLE_AUDIENCE)
                .and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(appleOAuthConfig.getClientSecretTtl())))
                .signWith(signingKey, Jwts.SIG.ES256)
                .compact();
    }

    /**
     * Reads the {@code .p8} contents; accepts real newlines or {@code \n} escapes from env vars.
     */
    private static PrivateKey parsePrivateKey(String pem) {
        try {
            String base64 =
                    pem.replace("\\n", "\n")
                            .replace("-----BEGIN PRIVATE KEY-----", "")
                            .replace("-----END PRIVATE KEY-----", "")
                            .replaceAll("\\s", "");
            return KeyFactory.getInstance("EC")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (Exception exception) {
            // Don't chain the cause: it may echo key material.
            throw new IllegalStateException(
                    "APPLE_PRIVATE_KEY is not a valid PKCS#8 EC private key on a named curve"
                            + " (paste the .p8 file from Apple as-is)");
        }
    }

    private static JdkClientHttpRequestFactory requestFactory(Duration httpTimeout) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(httpTimeout).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(httpTimeout);
        return requestFactory;
    }

    /** The parts of Apple's token response we use. */
    record AppleTokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("refresh_token") String refreshToken) {

        /** Records print every component by default; these are Apple tokens (#91). */
        @Override
        public String toString() {
            return "AppleTokenResponse[tokens hidden]";
        }
    }
}
