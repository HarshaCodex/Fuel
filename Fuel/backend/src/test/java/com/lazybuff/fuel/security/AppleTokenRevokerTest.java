package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.lazybuff.fuel.config.AppleOAuthConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@DisplayName("AppleTokenRevoker")
class AppleTokenRevokerTest {

    private static final String TOKEN_URI = "https://appleid.apple.com/auth/token";
    private static final String REVOKE_URI = "https://appleid.apple.com/auth/revoke";
    private static final String TEAM_ID = "TEAM123456";
    private static final String KEY_ID = "KEY1234567";
    private static final String CLIENT_ID = "com.lazybuff.fuel";
    private static final String CODE = "c0de-from-apple";

    private static final KeyPair KEY_PAIR = Jwts.SIG.ES256.keyPair().build();

    private AppleOAuthConfig config;

    private RestClient.Builder restClientBuilder;

    private MockRestServiceServer apple;

    @BeforeEach
    void setUp() {
        config = new AppleOAuthConfig();
        config.setTeamId(TEAM_ID);
        config.setKeyId(KEY_ID);
        config.setPrivateKey(pem(KEY_PAIR));
        config.setTokenUri(TOKEN_URI);
        config.setRevokeUri(REVOKE_URI);
        config.setClientSecretTtl(Duration.ofMinutes(5));
        restClientBuilder = RestClient.builder();
        apple = MockRestServiceServer.bindTo(restClientBuilder).build();
    }

    private static String pem(KeyPair keyPair) {
        return "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder().encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
    }

    private AppleTokenRevoker revoker() {
        return new AppleTokenRevoker(config, restClientBuilder);
    }

    private static Map<String, String> formFields(String body) {
        return Arrays.stream(body.split("&"))
                .map(pair -> pair.split("=", 2))
                .collect(
                        Collectors.toMap(
                                kv -> kv[0],
                                kv -> URLDecoder.decode(kv[1], StandardCharsets.UTF_8)));
    }

    private static void assertValidClientSecret(String clientSecret) {
        Jws<Claims> jws =
                Jwts.parser()
                        .verifyWith(KEY_PAIR.getPublic())
                        .build()
                        .parseSignedClaims(clientSecret);
        assertThat(jws.getHeader().getAlgorithm()).isEqualTo("ES256");
        assertThat(jws.getHeader().getKeyId()).isEqualTo(KEY_ID);
        assertThat(jws.getPayload().getIssuer()).isEqualTo(TEAM_ID);
        assertThat(jws.getPayload().getSubject()).isEqualTo(CLIENT_ID);
        assertThat(jws.getPayload().getAudience()).containsExactly("https://appleid.apple.com");
        assertThat(jws.getPayload().getExpiration()).isNotNull();
    }

    @Test
    @DisplayName("exchanges the code, then revokes the refresh token with a signed client secret")
    void shouldExchangeCodeThenRevokeRefreshToken() {
        apple.expect(requestTo(TOKEN_URI))
                .andExpect(method(HttpMethod.POST))
                .andExpect(
                        content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(
                        request -> {
                            Map<String, String> form = formFields(request.getBody().toString());
                            assertThat(form)
                                    .containsEntry("client_id", CLIENT_ID)
                                    .containsEntry("grant_type", "authorization_code")
                                    .containsEntry("code", CODE);
                            assertValidClientSecret(form.get("client_secret"));
                        })
                .andRespond(
                        withSuccess(
                                "{\"access_token\":\"at\",\"refresh_token\":\"rt\",\"id_token\":\"x\"}",
                                MediaType.APPLICATION_JSON));
        apple.expect(requestTo(REVOKE_URI))
                .andExpect(method(HttpMethod.POST))
                .andExpect(
                        request -> {
                            Map<String, String> form = formFields(request.getBody().toString());
                            assertThat(form)
                                    .containsEntry("client_id", CLIENT_ID)
                                    .containsEntry("token", "rt")
                                    .containsEntry("token_type_hint", "refresh_token");
                            assertValidClientSecret(form.get("client_secret"));
                        })
                .andRespond(withSuccess());

        revoker().revoke(CODE, CLIENT_ID);

        apple.verify();
    }

    @Test
    @DisplayName("revokes the access token when Apple returns no refresh token")
    void shouldFallBackToAccessToken() {
        apple.expect(requestTo(TOKEN_URI))
                .andRespond(withSuccess("{\"access_token\":\"at\"}", MediaType.APPLICATION_JSON));
        apple.expect(requestTo(REVOKE_URI))
                .andExpect(
                        request ->
                                assertThat(formFields(request.getBody().toString()))
                                        .containsEntry("token", "at")
                                        .containsEntry("token_type_hint", "access_token"))
                .andRespond(withSuccess());

        revoker().revoke(CODE, CLIENT_ID);

        apple.verify();
    }

    @Test
    @DisplayName("doesn't throw or call revoke when the code exchange fails")
    void shouldSwallowExchangeFailure() {
        apple.expect(requestTo(TOKEN_URI))
                .andRespond(
                        withBadRequest()
                                .body("{\"error\":\"invalid_grant\"}")
                                .contentType(MediaType.APPLICATION_JSON));

        assertThatCode(() -> revoker().revoke(CODE, CLIENT_ID)).doesNotThrowAnyException();

        // Only the exchange was expected; a revoke call would fail verification.
        apple.verify();
    }

    @Test
    @DisplayName("doesn't throw when the revoke call fails")
    void shouldSwallowRevokeFailure() {
        apple.expect(requestTo(TOKEN_URI))
                .andRespond(withSuccess("{\"refresh_token\":\"rt\"}", MediaType.APPLICATION_JSON));
        apple.expect(requestTo(REVOKE_URI)).andRespond(withServerError());

        assertThatCode(() -> revoker().revoke(CODE, CLIENT_ID)).doesNotThrowAnyException();

        apple.verify();
    }

    @Test
    @DisplayName("skips revocation without calling Apple when credentials aren't configured")
    void shouldSkipWhenNotConfigured() {
        config.setPrivateKey("");

        assertThatCode(() -> revoker().revoke(CODE, CLIENT_ID)).doesNotThrowAnyException();

        apple.verify();
    }

    @Test
    @DisplayName("accepts a key whose newlines arrive as \\n escapes from an env var")
    void shouldAcceptEscapedNewlines() {
        config.setPrivateKey(pem(KEY_PAIR).replace("\n", "\\n"));
        apple.expect(requestTo(TOKEN_URI))
                .andExpect(
                        request ->
                                assertValidClientSecret(
                                        formFields(request.getBody().toString())
                                                .get("client_secret")))
                .andRespond(withSuccess("{\"refresh_token\":\"rt\"}", MediaType.APPLICATION_JSON));
        apple.expect(requestTo(REVOKE_URI)).andRespond(withSuccess());

        revoker().revoke(CODE, CLIENT_ID);

        apple.verify();
    }

    @Test
    @DisplayName("fails at startup on a malformed key, without echoing it")
    void shouldRejectMalformedKey() {
        config.setPrivateKey("-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----");

        assertThatThrownBy(this::revoker)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("not-a-key")
                .hasNoCause();
    }
}
