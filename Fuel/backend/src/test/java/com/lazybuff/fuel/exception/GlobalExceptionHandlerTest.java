package com.lazybuff.fuel.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.lazybuff.fuel.dto.ErrorResponse;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("returns 404 for an unknown route instead of 500")
    void shouldReturnNotFoundForUnknownRoute() {
        ResponseEntity<ErrorResponse> response =
                handler.handleNoResourceFound(
                        new NoResourceFoundException(
                                HttpMethod.GET, "/v3/api-docs", "v3/api-docs"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().getStatus()).isEqualTo(404);
        assertThat(response.getBody().getMessage()).isEqualTo("Resource not found");
    }

    @Test
    @DisplayName("returns 400 with a generic message for an unreadable request body")
    void shouldReturnBadRequestForUnreadableBody() {
        ResponseEntity<ErrorResponse> response =
                handler.handleUnreadableBody(
                        new HttpMessageNotReadableException(
                                "Cannot deserialize secret detail", mock(HttpInputMessage.class)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().getStatus()).isEqualTo(400);
        assertThat(response.getBody().getMessage()).isEqualTo("Malformed request body");
    }

    @Test
    @DisplayName("returns 400 naming the field for a missing request parameter")
    void shouldReturnBadRequestForMissingParameter() {
        ResponseEntity<ErrorResponse> response =
                handler.handleMissingParameter(
                        new MissingServletRequestParameterException("q", "String"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().getMessage()).isEqualTo("Validation failed");
        assertThat(response.getBody().getErrors()).hasSize(1);
        assertThat(response.getBody().getErrors().getFirst().getField()).isEqualTo("q");
    }

    @Test
    @DisplayName("returns 429 with Retry-After header and retryAfter body when rate limited")
    void shouldReturnTooManyRequestsWithRetryAfter() {
        ResponseEntity<ErrorResponse> response =
                handler.handleRateLimitExceeded(
                        new RateLimitExceededException("Slow down", Duration.ofSeconds(30)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("30");
        assertThat(response.getBody().getRetryAfter()).isEqualTo(30L);
        assertThat(response.getBody().getMessage()).isEqualTo("Slow down");
    }
}
