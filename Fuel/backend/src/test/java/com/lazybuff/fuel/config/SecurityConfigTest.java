package com.lazybuff.fuel.config;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.controller.FoodItemController;
import com.lazybuff.fuel.security.RestAuthEntryPoint;
import com.lazybuff.fuel.service.FoodService;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.RateLimiterService;
import io.jsonwebtoken.JwtException;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FoodItemController.class)
@Import({SecurityConfig.class, RestAuthEntryPoint.class, IpRateLimitConfig.class})
@DisplayName("SecurityConfig")
class SecurityConfigTest {

    private static final String PROTECTED_URL = "/api/food/" + UUID.randomUUID();

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtService jwtService;

    @MockitoBean private FoodService foodService;

    // WebConfig (a WebMvcConfigurer, so part of the slice) needs it to register rate-limit
    // interceptors.
    @MockitoBean private RateLimiterService rateLimiterService;

    @Test
    void shouldReturnStandardErrorBodyWhenAuthorizationHeaderMissing() throws Exception {
        mockMvc.perform(get(PROTECTED_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid or missing credentials."))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void shouldReturnStandardErrorBodyWhenJwtInvalid() throws Exception {
        when(jwtService.parseAndValidate(anyString())).thenThrow(new JwtException("expired"));

        mockMvc.perform(
                        get(PROTECTED_URL)
                                .header(HttpHeaders.AUTHORIZATION, "Bearer bad.token.value"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid or missing credentials."));
    }
}
