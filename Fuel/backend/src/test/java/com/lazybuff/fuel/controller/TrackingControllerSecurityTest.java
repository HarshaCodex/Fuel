package com.lazybuff.fuel.controller;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.config.IpRateLimitConfig;
import com.lazybuff.fuel.config.SecurityConfig;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.logging.RequestIdFilter;
import com.lazybuff.fuel.security.RestAccessDeniedHandler;
import com.lazybuff.fuel.security.RestAuthEntryPoint;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.RateLimiterService;
import com.lazybuff.fuel.service.TrackingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TrackingController.class)
@Import({
    SecurityConfig.class,
    RestAuthEntryPoint.class,
    RestAccessDeniedHandler.class,
    IpRateLimitConfig.class,
    RequestIdFilter.class,
    GlobalExceptionHandler.class
})
@DisplayName("TrackingController security")
class TrackingControllerSecurityTest {

    private static final String BODY =
            "{\"foodId\":\"22222222-2222-2222-2222-222222222222\",\"servingSize\":100,"
                    + "\"servingUnit\":\"g\",\"quantity\":1}";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtService jwtService;

    @MockitoBean private TrackingService trackingService;

    // WebConfig needs it to register rate-limit interceptors.
    @MockitoBean private RateLimiterService rateLimiterService;

    @Test
    @DisplayName("returns 401 without an access token")
    void shouldReturnUnauthorizedWithoutToken() throws Exception {
        mockMvc.perform(
                        post("/api/tracking/entries")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("GET returns 401 without an access token")
    void shouldReturnUnauthorizedOnListWithoutToken() throws Exception {
        mockMvc.perform(get("/api/tracking/entries")).andExpect(status().isUnauthorized());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("DELETE returns 401 without an access token")
    void shouldReturnUnauthorizedOnDeleteWithoutToken() throws Exception {
        mockMvc.perform(delete("/api/tracking/entries/22222222-2222-2222-2222-222222222222"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("PUT returns 401 without an access token")
    void shouldReturnUnauthorizedOnUpdateWithoutToken() throws Exception {
        mockMvc.perform(
                        put("/api/tracking/entries/22222222-2222-2222-2222-222222222222")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(trackingService);
    }
}
