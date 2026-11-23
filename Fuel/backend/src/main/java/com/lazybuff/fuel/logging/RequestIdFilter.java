package com.lazybuff.fuel.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Tags every log line of a request with a request ID (#108), so one request's logs can be pulled
 * out of interleaved output, and returns the ID in the {@code X-Request-Id} response header so a
 * reported error can be traced.
 *
 * <p>Runs before every other filter (including Spring Security), so responses rejected early, such
 * as 401s, still carry the ID. A caller-supplied ID is reused only if it matches a short, safe
 * pattern; anything else is replaced, so the header can't inject content into the logs.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    /** Header read from the request and written on the response. */
    public static final String HEADER = "X-Request-Id";

    /** MDC key; appears as {@code requestId} in JSON logs and as a Sentry tag. */
    public static final String MDC_KEY = "requestId";

    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{8,64}");

    @Override
    protected void doFilterInternal(
            final HttpServletRequest request,
            final HttpServletResponse response,
            final FilterChain filterChain)
            throws ServletException, IOException {
        final String requestId = resolve(request.getHeader(HEADER));
        MDC.put(MDC_KEY, requestId);
        response.setHeader(HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            // Servlet threads are pooled: never let the ID leak into the next request.
            MDC.remove(MDC_KEY);
        }
    }

    private static String resolve(final String incoming) {
        if (incoming != null && SAFE_ID.matcher(incoming).matches()) {
            return incoming;
        }
        return UUID.randomUUID().toString();
    }
}
