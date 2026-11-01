package com.lazybuff.fuel.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.config.IpRateLimitConfig;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.exception.RateLimitExceededException;
import com.lazybuff.fuel.service.RateLimiterService;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@ExtendWith(MockitoExtension.class)
@DisplayName("IpRateLimitInterceptor")
class IpRateLimitInterceptorTest {

    private static final String PATH = "/api/auth/login";
    private static final String CLIENT_IP = "203.0.113.7";
    private static final Duration WINDOW = Duration.ofMinutes(1);

    @Mock private RateLimiterService rateLimiterService;

    private MockMvc mockMvc;

    /**
     * Stands in for AuthController so the test exercises routing, the interceptor and the advice.
     */
    @RestController
    static class StubController {
        @PostMapping(PATH)
        String post() {
            return "ok";
        }

        @GetMapping(PATH)
        String get() {
            return "ok";
        }
    }

    @BeforeEach
    void setUp() {
        IpRateLimitConfig.Rule rule = new IpRateLimitConfig.Rule();
        rule.setPath(PATH);
        rule.setMaxRequests(5);
        rule.setWindow(WINDOW);

        mockMvc =
                MockMvcBuilders.standaloneSetup(new StubController())
                        .addMappedInterceptors(
                                new String[] {PATH},
                                new IpRateLimitInterceptor("login", rule, rateLimiterService))
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .build();
    }

    @Test
    @DisplayName("counts POSTs per client IP under the rule's key")
    void shouldEnforceLimitPerClientIp() throws Exception {
        mockMvc.perform(post(PATH).with(IpRateLimitInterceptorTest::withRemoteAddr))
                .andExpect(status().isOk());

        verify(rateLimiterService)
                .enforce(
                        "rate_limit:ip:login:" + CLIENT_IP,
                        5,
                        WINDOW,
                        IpRateLimitInterceptor.MESSAGE);
    }

    @Test
    @DisplayName("returns 429 with Retry-After header and retryAfter body when over the limit")
    void shouldReturnTooManyRequestsWithRetryAfter() throws Exception {
        doThrow(
                        new RateLimitExceededException(
                                IpRateLimitInterceptor.MESSAGE, Duration.ofSeconds(45)))
                .when(rateLimiterService)
                .enforce(anyString(), anyInt(), any(Duration.class), anyString());

        mockMvc.perform(post(PATH).with(IpRateLimitInterceptorTest::withRemoteAddr))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "45"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value(IpRateLimitInterceptor.MESSAGE))
                .andExpect(jsonPath("$.retryAfter").value(45));
    }

    @Test
    @DisplayName("does not count non-POST requests")
    void shouldIgnoreNonPostRequests() throws Exception {
        mockMvc.perform(get(PATH)).andExpect(status().isOk());

        verifyNoInteractions(rateLimiterService);
    }

    private static MockHttpServletRequest withRemoteAddr(MockHttpServletRequest request) {
        request.setRemoteAddr(CLIENT_IP);
        return request;
    }
}
