package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@DisplayName("RestAccessDeniedHandler")
class RestAccessDeniedHandlerTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() throws Exception {
        response = new MockHttpServletResponse();
        new RestAccessDeniedHandler(jsonMapper)
                .handle(
                        new MockHttpServletRequest("GET", "/api/admin/users"),
                        response,
                        new AccessDeniedException("Access Denied: missing ROLE_ADMIN"));
    }

    @Test
    void shouldRespondWithForbiddenStatus() {
        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
    }

    @Test
    void shouldRespondWithJsonContentType() {
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
    }

    @Test
    void shouldWriteStandardErrorResponseBody() throws Exception {
        final JsonNode body = jsonMapper.readTree(response.getContentAsString());

        assertThat(body.get("status").asInt()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(body.get("message").asString())
                .isEqualTo(GlobalExceptionHandler.FORBIDDEN_MESSAGE);
        assertThat(body.hasNonNull("timestamp")).isTrue();
    }

    @Test
    void shouldNotLeakExceptionDetailsInBody() throws Exception {
        assertThat(response.getContentAsString()).doesNotContain("ROLE_ADMIN");
    }
}
