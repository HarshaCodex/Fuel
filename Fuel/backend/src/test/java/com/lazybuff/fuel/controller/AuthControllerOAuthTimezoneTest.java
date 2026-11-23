package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.AppleOAuthService;
import com.lazybuff.fuel.service.AuthService;
import com.lazybuff.fuel.service.GoogleOAuthService;
import com.lazybuff.fuel.service.VerificationCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController OAuth timezone")
class AuthControllerOAuthTimezoneTest {

    private static final String TOO_LONG_TIMEZONE = "A".repeat(51);

    @Mock private AuthService authService;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private GoogleOAuthService googleOAuthService;
    @Mock private AppleOAuthService appleOAuthService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(
                                new AuthController(
                                        authService,
                                        verificationCodeService,
                                        googleOAuthService,
                                        appleOAuthService))
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .build();
    }

    @Test
    @DisplayName("rejects a Google timezone over 50 characters")
    void shouldRejectOverlongGoogleTimezone() throws Exception {
        mockMvc.perform(
                        post("/api/auth/oauth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"idToken\":\"t\",\"timezone\":\""
                                                + TOO_LONG_TIMEZONE
                                                + "\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(googleOAuthService);
    }

    @Test
    @DisplayName("accepts a Google request with a valid-length timezone")
    void shouldAcceptGoogleTimezone() throws Exception {
        when(googleOAuthService.authenticate(any(), any()))
                .thenReturn(ApiResponse.<UserData>builder().status(200).build());

        mockMvc.perform(
                        post("/api/auth/oauth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"idToken\":\"t\",\"timezone\":\"Asia/Kolkata\"}"))
                .andExpect(status().isOk());

        verify(googleOAuthService).authenticate(any(), any());
    }

    @Test
    @DisplayName("rejects an Apple timezone over 50 characters")
    void shouldRejectOverlongAppleTimezone() throws Exception {
        mockMvc.perform(
                        post("/api/auth/oauth/apple")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"identityToken\":\"t\",\"timezone\":\""
                                                + TOO_LONG_TIMEZONE
                                                + "\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(appleOAuthService);
    }

    @Test
    @DisplayName("accepts an Apple request with a valid-length timezone")
    void shouldAcceptAppleTimezone() throws Exception {
        when(appleOAuthService.authenticate(any(), any()))
                .thenReturn(ApiResponse.<UserData>builder().status(200).build());

        mockMvc.perform(
                        post("/api/auth/oauth/apple")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"identityToken\":\"t\",\"timezone\":\"Asia/Kolkata\"}"))
                .andExpect(status().isOk());

        verify(appleOAuthService).authenticate(any(), any());
    }
}
