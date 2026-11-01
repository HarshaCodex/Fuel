package com.lazybuff.fuel.security;

import com.lazybuff.fuel.dto.ErrorResponse;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes the standard {@link ErrorResponse} envelope with HTTP 403 when the security filter chain
 * rejects an authenticated request (e.g. a role/authority rule). Without this, Spring Security's
 * default handler sends an empty body. Access denied inside controllers is handled by {@link
 * GlobalExceptionHandler} with the same message.
 */
@Component
@RequiredArgsConstructor
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final JsonMapper jsonMapper;

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException)
            throws IOException {
        final ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.FORBIDDEN.value())
                        .message(GlobalExceptionHandler.FORBIDDEN_MESSAGE)
                        .timestamp(LocalDateTime.now())
                        .build();

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}
