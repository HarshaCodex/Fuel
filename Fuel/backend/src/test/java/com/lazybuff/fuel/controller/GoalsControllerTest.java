package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.GoalsService;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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
@DisplayName("GoalsController")
class GoalsControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String URL = "/api/user/goals";

    @Mock private GoalsService goalsService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(new GoalsController(goalsService))
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

    private static String body(String calories, String protein, String carb, String fat) {
        return "{\"calorieGoal\":%s,\"proteinGoal\":%s,\"carbGoal\":%s,\"fatGoal\":%s}"
                .formatted(calories, protein, carb, fat);
    }

    private static String validBody() {
        return body("1800", "150.0", "180.0", "60.0");
    }

    private static ApiResponse<GoalsResponse> ok(GoalsResponse data) {
        return ApiResponse.<GoalsResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private static GoalsResponse sample() {
        return new GoalsResponse(
                2200, 165.0, 248.0, 73.0, false, OffsetDateTime.parse("2026-06-05T08:00:00Z"));
    }

    private void assertBadRequest(String json) throws Exception {
        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(goalsService);
    }

    @Test
    @DisplayName("returns the caller's goals with the isAutoCalculated key")
    void shouldReturnGoals() throws Exception {
        when(goalsService.get(USER_ID)).thenReturn(ok(sample()));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.calorieGoal").value(2200))
                .andExpect(jsonPath("$.data.proteinGoal").value(165.0))
                .andExpect(jsonPath("$.data.carbGoal").value(248.0))
                .andExpect(jsonPath("$.data.fatGoal").value(73.0))
                .andExpect(jsonPath("$.data.isAutoCalculated").value(false))
                .andExpect(jsonPath("$.data.autoCalculated").doesNotExist())
                .andExpect(jsonPath("$.data.updatedAt").value("2026-06-05T08:00:00Z"));
    }

    @Test
    @DisplayName("saves and returns the goals")
    void shouldSaveGoals() throws Exception {
        when(goalsService.put(eq(USER_ID), any(GoalsRequest.class))).thenReturn(ok(sample()));

        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.isAutoCalculated").value(false));
    }

    @Test
    @DisplayName("propagates 404 on get when the user no longer exists")
    void shouldPropagateNotFoundOnGet() throws Exception {
        when(goalsService.get(USER_ID))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(get(URL)).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("propagates 404 on put when the user no longer exists")
    void shouldPropagateNotFoundOnPut() throws Exception {
        when(goalsService.put(eq(USER_ID), any(GoalsRequest.class)))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"800", "10000"})
    @DisplayName("accepts calorie goals at the bounds")
    void shouldAcceptCalorieBounds(String calories) throws Exception {
        when(goalsService.put(eq(USER_ID), any(GoalsRequest.class))).thenReturn(ok(sample()));

        mockMvc.perform(
                        put(URL).contentType(MediaType.APPLICATION_JSON)
                                .content(body(calories, "150", "180", "60")))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "799", "10001", "null", "\"abc\"", "\"\""})
    @DisplayName("returns 400 for an invalid calorie goal")
    void shouldRejectBadCalories(String calories) throws Exception {
        assertBadRequest(body(calories, "150", "180", "60"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.0", "9999.9"})
    @DisplayName("accepts macros at the bounds")
    void shouldAcceptMacroBounds(String macro) throws Exception {
        when(goalsService.put(eq(USER_ID), any(GoalsRequest.class))).thenReturn(ok(sample()));

        mockMvc.perform(
                        put(URL).contentType(MediaType.APPLICATION_JSON)
                                .content(body("1800", macro, macro, macro)))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.1", "-5", "10000.0", "9999.95", "null", "\"abc\""})
    @DisplayName("returns 400 for an invalid protein, carb or fat goal")
    void shouldRejectBadMacros(String macro) throws Exception {
        assertBadRequest(body("1800", macro, "180", "60"));
        assertBadRequest(body("1800", "150", macro, "60"));
        assertBadRequest(body("1800", "150", "180", macro));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"proteinGoal\":150,\"carbGoal\":180,\"fatGoal\":60}",
                "{\"calorieGoal\":1800,\"carbGoal\":180,\"fatGoal\":60}",
                "{\"calorieGoal\":1800,\"proteinGoal\":150,\"fatGoal\":60}",
                "{\"calorieGoal\":1800,\"proteinGoal\":150,\"carbGoal\":180}",
                "{}"
            })
    @DisplayName("returns 400 when a required field is missing")
    void shouldRejectMissingField(String json) throws Exception {
        assertBadRequest(json);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"calorieGoal\":", "not json", "null", ""})
    @DisplayName("returns 400 for a broken or empty body")
    void shouldRejectUnreadableBody(String json) throws Exception {
        assertBadRequest(json);
    }
}
