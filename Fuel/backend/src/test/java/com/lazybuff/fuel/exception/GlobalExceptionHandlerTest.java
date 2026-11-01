package com.lazybuff.fuel.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.ErrorResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
}
