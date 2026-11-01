package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.IpRateLimitConfig;
import com.lazybuff.fuel.service.RateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Throttles POSTs to one endpoint per client IP.
 *
 * <p>Uses {@link HttpServletRequest#getRemoteAddr()}: behind a proxy, {@code
 * server.forward-headers-strategy=native} makes Tomcat replace it with the client address from
 * {@code X-Forwarded-For}, but only when the request comes from a trusted internal proxy, so
 * clients can't spoof their way around the limit.
 */
public class IpRateLimitInterceptor implements HandlerInterceptor {

    static final String MESSAGE = "Too many requests. Please try again later.";

    private static final String KEY_PREFIX = "rate_limit:ip:";

    private final String ruleName;

    private final IpRateLimitConfig.Rule rule;

    private final RateLimiterService rateLimiterService;

    public IpRateLimitInterceptor(
            String ruleName, IpRateLimitConfig.Rule rule, RateLimiterService rateLimiterService) {
        this.ruleName = ruleName;
        this.rule = rule;
        this.rateLimiterService = rateLimiterService;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler) {

        if (HttpMethod.POST.matches(request.getMethod())) {
            rateLimiterService.enforce(
                    KEY_PREFIX + ruleName + ":" + request.getRemoteAddr(),
                    rule.getMaxRequests(),
                    rule.getWindow(),
                    MESSAGE);
        }
        return true;
    }
}
