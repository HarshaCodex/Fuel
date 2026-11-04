package com.lazybuff.fuel.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.config.IpRateLimitConfig;
import com.lazybuff.fuel.config.SecurityConfig;
import com.lazybuff.fuel.logging.RequestIdFilter;
import com.lazybuff.fuel.security.RestAccessDeniedHandler;
import com.lazybuff.fuel.security.RestAuthEntryPoint;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.RateLimiterService;
import com.lazybuff.fuel.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(UserController.class)
@Import({
    SecurityConfig.class,
    RestAuthEntryPoint.class,
    RestAccessDeniedHandler.class,
    IpRateLimitConfig.class,
    RequestIdFilter.class
})
@DisplayName("UserController security")
class UserControllerSecurityTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtService jwtService;

    @MockitoBean private UserService userService;

    // WebConfig needs it to register rate-limit interceptors.
    @MockitoBean private RateLimiterService rateLimiterService;

    @Test
    @DisplayName("returns 401 for a profile update without an access token")
    void shouldReturnUnauthorizedWhenUpdatingProfileWithoutToken() throws Exception {
        mockMvc.perform(
                        put("/api/user/profile")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Harsha B\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }
}
