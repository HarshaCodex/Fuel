package com.lazybuff.fuel.security;

import com.lazybuff.fuel.exception.FuelException;
import java.net.http.HttpClient;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Fetches an OAuth provider's public signing keys (JWK Set) used to verify its tokens. */
@Component
@Slf4j
public class JwksClient {

    private final RestClient restClient;

    public JwksClient(@Value("${app.oauth.http-timeout}") Duration httpTimeout) {

        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(httpTimeout).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(httpTimeout);

        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /**
     * Returns the raw JWK Set JSON published at {@code jwksUri}.
     *
     * @param providerName shown to the user if the keys can't be fetched, e.g. "Google"
     * @throws FuelException with 503 when the provider's key endpoint can't be reached
     */
    public String fetchJwks(String jwksUri, String providerName) {
        try {
            String body = restClient.get().uri(jwksUri).retrieve().body(String.class);

            if (body == null || body.isBlank()) {
                throw new RestClientException("Empty JWK Set response");
            }
            return body;

        } catch (RestClientException exception) {
            log.error("Failed to fetch {} signing keys, exception:", providerName, exception);
            throw new FuelException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    providerName + " sign-in is temporarily unavailable");
        }
    }
}
