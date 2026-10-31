package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.InsufficientAuthenticationException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@DisplayName("RestAuthEntryPoint")
class RestAuthEntryPointTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    private RestAuthEntryPoint entryPoint;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() throws Exception {
        entryPoint = new RestAuthEntryPoint(jsonMapper);
        response = new MockHttpServletResponse();
        entryPoint.commence(
                new MockHttpServletRequest("GET", "/api/food/1"),
                response,
                new InsufficientAuthenticationException("Full authentication is required"));
    }

    @Test
    void shouldRespondWithUnauthorizedStatus() {
        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    void shouldRespondWithJsonContentType() {
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
    }

    @Test
    void shouldWriteStandardErrorResponseBody() throws Exception {
        final JsonNode body = jsonMapper.readTree(response.getContentAsString());

        assertThat(body.get("status").asInt()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(body.get("message").asString())
                .isEqualTo(RestAuthEntryPoint.UNAUTHORIZED_MESSAGE);
        assertThat(body.hasNonNull("timestamp")).isTrue();
    }

    @Test
    void shouldNotLeakExceptionDetailsInBody() throws Exception {
        assertThat(response.getContentAsString()).doesNotContain("Full authentication is required");
    }
}
