package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.GoogleOAuthConfig;
import com.lazybuff.fuel.exception.FuelException;
import java.net.http.HttpClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Fetches Google's public signing keys (JWK Set) used to verify Google ID tokens. */
@Component
@Slf4j
public class GoogleJwksClient {

    private final RestClient restClient;

    private final GoogleOAuthConfig googleOAuthConfig;

    public GoogleJwksClient(GoogleOAuthConfig googleOAuthConfig) {
        this.googleOAuthConfig = googleOAuthConfig;

        HttpClient httpClient =
                HttpClient.newBuilder().connectTimeout(googleOAuthConfig.getHttpTimeout()).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(googleOAuthConfig.getHttpTimeout());

        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * Returns the raw JWK Set JSON.
     *
     * @throws FuelException with 503 when Google's key endpoint can't be reached
     */
    public String fetchJwks() {
        try {
            String body =
                    restClient
                            .get()
                            .uri(googleOAuthConfig.getJwksUri())
                            .retrieve()
                            .body(String.class);

            if (body == null || body.isBlank()) {
                throw new RestClientException("Empty JWK Set response");
            }
            return body;

        } catch (RestClientException exception) {
            log.error("Failed to fetch Google signing keys, exception:", exception);
            throw new FuelException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is temporarily unavailable");
        }
    }
}
