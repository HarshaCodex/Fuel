package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DeleteAccountRequest;
import com.lazybuff.fuel.dto.UpdateProfileRequest;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.UserService;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserController")
class UserControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private UserService userService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(new UserController(userService))
                        .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .build();
        // Mirrors JwtAuthFilter: the principal is the user id from the token's subject.
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                USER_ID.toString(), null, List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("returns the authenticated user's profile")
    void shouldReturnProfileForAuthenticatedUser() throws Exception {
        UserProfile profile =
                new UserProfile(
                        USER_ID.toString(),
                        "user@example.com",
                        "Harsha",
                        null,
                        true,
                        AuthProvider.EMAIL,
                        "Asia/Kolkata",
                        OffsetDateTime.of(2026, 6, 1, 10, 0, 0, 0, ZoneOffset.UTC));
        when(userService.getProfile(USER_ID))
                .thenReturn(
                        ApiResponse.<UserProfile>builder()
                                .status(HttpStatus.OK.value())
                                .message("Success")
                                .data(profile)
                                .timestamp(LocalDateTime.now())
                                .build());

        mockMvc.perform(get("/api/user/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(USER_ID.toString()))
                .andExpect(jsonPath("$.data.email").value("user@example.com"))
                .andExpect(jsonPath("$.data.emailVerified").value(true))
                .andExpect(jsonPath("$.data.authProvider").value("EMAIL"))
                .andExpect(jsonPath("$.data.timezone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.data.createdAt").value("2026-06-01T10:00:00Z"));
    }

    @Test
    @DisplayName("returns 404 when the user no longer exists")
    void shouldReturnNotFoundWhenUserMissing() throws Exception {
        when(userService.getProfile(USER_ID))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(get("/api/user/profile"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    private static final String DELETE_URL = "/api/user/account";

    @Test
    @DisplayName("deletes the authenticated user's account")
    void shouldDeleteAccount() throws Exception {
        when(userService.deleteAccount(eq(USER_ID), any(DeleteAccountRequest.class)))
                .thenReturn(
                        ApiResponse.<Void>builder()
                                .status(HttpStatus.OK.value())
                                .message("Account deleted successfully")
                                .build());

        mockMvc.perform(
                        delete(DELETE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"Password1!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Account deleted successfully"));
    }

    @Test
    @DisplayName("returns 400 without calling the service when no confirmation is sent")
    void shouldRejectMissingConfirmation() throws Exception {
        mockMvc.perform(delete(DELETE_URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("returns 400 when more than one confirmation is sent")
    void shouldRejectTwoConfirmations() throws Exception {
        mockMvc.perform(
                        delete(DELETE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"Password1!\",\"googleIdToken\":\"t\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("returns 400 when an Apple identity token comes without its authorization code")
    void shouldRequireAppleAuthorizationCode() throws Exception {
        mockMvc.perform(
                        delete(DELETE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"appleIdentityToken\":\"t\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }

    private static final String PROFILE_URL = "/api/user/profile";

    @Test
    @DisplayName("updates the profile and returns the updated shape")
    void shouldUpdateProfile() throws Exception {
        UserProfile profile =
                new UserProfile(
                        USER_ID.toString(),
                        "user@example.com",
                        "Harsha B",
                        null,
                        true,
                        AuthProvider.EMAIL,
                        "Asia/Kolkata",
                        OffsetDateTime.of(2026, 6, 1, 10, 0, 0, 0, ZoneOffset.UTC));
        when(userService.updateProfile(eq(USER_ID), any(UpdateProfileRequest.class)))
                .thenReturn(
                        ApiResponse.<UserProfile>builder()
                                .status(HttpStatus.OK.value())
                                .message("Success")
                                .data(profile)
                                .timestamp(LocalDateTime.now())
                                .build());

        mockMvc.perform(
                        put(PROFILE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"Harsha B\",\"timezone\":\"Asia/Kolkata\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.name").value("Harsha B"))
                .andExpect(jsonPath("$.data.timezone").value("Asia/Kolkata"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    @DisplayName("returns 400 for a blank name")
    void shouldRejectBlankName(String name) throws Exception {
        mockMvc.perform(
                        put(PROFILE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));

        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("returns 400 for a name longer than 100 characters")
    void shouldRejectOverlongName() throws Exception {
        mockMvc.perform(
                        put(PROFILE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"" + "a".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("name"));

        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("returns 400 for a timezone longer than 50 characters")
    void shouldRejectOverlongTimezone() throws Exception {
        mockMvc.perform(
                        put(PROFILE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"timezone\":\"" + "a".repeat(51) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("timezone"));

        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("returns 400 when the service rejects the timezone")
    void shouldReturnBadRequestForInvalidTimezone() throws Exception {
        when(userService.updateProfile(eq(USER_ID), any(UpdateProfileRequest.class)))
                .thenThrow(new FuelException(HttpStatus.BAD_REQUEST, "Invalid timezone."));

        mockMvc.perform(
                        put(PROFILE_URL)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"timezone\":\"Mars/Base\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid timezone."));
    }
}
