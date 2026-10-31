package com.lazybuff.fuel.security;

import com.lazybuff.fuel.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes the standard {@link ErrorResponse} envelope with HTTP 401 when a request to a protected
 * endpoint has a missing, malformed or expired JWT. Without this, Spring Security's default entry
 * point responds with an empty body, which is inconsistent with every other error path in the API.
 */
@Component
@RequiredArgsConstructor
public class RestAuthEntryPoint implements AuthenticationEntryPoint {

    static final String UNAUTHORIZED_MESSAGE = "Invalid or missing credentials.";

    private final JsonMapper jsonMapper;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException)
            throws IOException {
        final ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.UNAUTHORIZED.value())
                        .message(UNAUTHORIZED_MESSAGE)
                        .timestamp(LocalDateTime.now())
                        .build();

        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
