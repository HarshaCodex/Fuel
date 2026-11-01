package com.lazybuff.fuel.config;

import com.lazybuff.fuel.security.IpRateLimitInterceptor;
import com.lazybuff.fuel.service.RateLimiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers one rate-limit interceptor per configured endpoint rule. */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final IpRateLimitConfig ipRateLimitConfig;

    private final RateLimiterService rateLimiterService;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        ipRateLimitConfig
                .getEndpoints()
                .forEach(
                        (name, rule) ->
                                registry.addInterceptor(
                                                new IpRateLimitInterceptor(
                                                        name, rule, rateLimiterService))
                                        .addPathPatterns(rule.getPath()));
    }
}
