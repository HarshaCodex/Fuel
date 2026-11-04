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
import com.lazybuff.fuel.dto.BodyStatsRequest;
import com.lazybuff.fuel.dto.BodyStatsResponse;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.BodyStatsService;
import java.math.BigDecimal;
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
@DisplayName("BodyStatsController")
class BodyStatsControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String URL = "/api/user/body-stats";

    @Mock private BodyStatsService bodyStatsService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(new BodyStatsController(bodyStatsService))
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

    private static String body(
            String height,
            String heightUnit,
            String weight,
            String weightUnit,
            String age,
            String gender,
            String activity) {
        return """
                {"height":%s,"heightUnit":%s,"weight":%s,"weightUnit":%s,"age":%s,"gender":%s,"activityLevel":%s}
                """
                .formatted(height, heightUnit, weight, weightUnit, age, gender, activity);
    }

    private static String validBody() {
        return body("175", "\"cm\"", "72.5", "\"kg\"", "25", "\"MALE\"", "\"MODERATE\"");
    }

    private static ApiResponse<BodyStatsResponse> ok(BodyStatsResponse data) {
        return ApiResponse.<BodyStatsResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private static BodyStatsResponse sample() {
        return new BodyStatsResponse(
                new BigDecimal("175.0"),
                "cm",
                new BigDecimal("72.5"),
                "kg",
                25,
                "MALE",
                "MODERATE",
                OffsetDateTime.parse("2026-06-05T08:00:00Z"));
    }

    @Test
    @DisplayName("returns the caller's stats")
    void shouldReturnStats() throws Exception {
        when(bodyStatsService.get(USER_ID)).thenReturn(ok(sample()));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.height").value(175.0))
                .andExpect(jsonPath("$.data.heightUnit").value("cm"))
                .andExpect(jsonPath("$.data.weight").value(72.5))
                .andExpect(jsonPath("$.data.weightUnit").value("kg"))
                .andExpect(jsonPath("$.data.age").value(25))
                .andExpect(jsonPath("$.data.gender").value("MALE"))
                .andExpect(jsonPath("$.data.activityLevel").value("MODERATE"))
                .andExpect(jsonPath("$.data.updatedAt").value("2026-06-05T08:00:00Z"));
    }

    @Test
    @DisplayName("returns 200 with null data when nothing was saved")
    void shouldReturnNullDataWhenNoneSaved() throws Exception {
        when(bodyStatsService.get(USER_ID)).thenReturn(ok(null));

        mockMvc.perform(get(URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("saves and returns the stats")
    void shouldSaveStats() throws Exception {
        when(bodyStatsService.put(eq(USER_ID), any(BodyStatsRequest.class)))
                .thenReturn(ok(sample()));

        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.weight").value(72.5));
    }

    @Test
    @DisplayName("propagates 404 when the user no longer exists")
    void shouldPropagateNotFound() throws Exception {
        when(bodyStatsService.put(eq(USER_ID), any(BodyStatsRequest.class)))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));
    }

    @Test
    @DisplayName("propagates 400 from a range check in the service")
    void shouldPropagateRangeError() throws Exception {
        when(bodyStatsService.put(eq(USER_ID), any(BodyStatsRequest.class)))
                .thenThrow(new FuelException(HttpStatus.BAD_REQUEST, "Height out of range"));

        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("returns 400 when a required field is missing")
    void shouldRejectMissingField() throws Exception {
        mockMvc.perform(
                        put(URL).contentType(MediaType.APPLICATION_JSON)
                                .content("{\"height\":175,\"heightUnit\":\"cm\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(bodyStatsService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"OTHER\"", "\"male\"", "\"\"", "null"})
    @DisplayName("returns 400 for an unknown gender")
    void shouldRejectBadGender(String gender) throws Exception {
        assertBadRequest(body("175", "\"cm\"", "72.5", "\"kg\"", "25", gender, "\"MODERATE\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"EXTREME\"", "\"moderate\"", "\"\"", "null"})
    @DisplayName("returns 400 for an unknown activity level")
    void shouldRejectBadActivityLevel(String activity) throws Exception {
        assertBadRequest(body("175", "\"cm\"", "72.5", "\"kg\"", "25", "\"MALE\"", activity));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"m\"", "\"CM\"", "\"\"", "null"})
    @DisplayName("returns 400 for an unknown height unit")
    void shouldRejectBadHeightUnit(String unit) throws Exception {
        assertBadRequest(body("175", unit, "72.5", "\"kg\"", "25", "\"MALE\"", "\"MODERATE\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"g\"", "\"lb\"", "\"\"", "null"})
    @DisplayName("returns 400 for an unknown weight unit")
    void shouldRejectBadWeightUnit(String unit) throws Exception {
        assertBadRequest(body("175", "\"cm\"", "72.5", unit, "25", "\"MALE\"", "\"MODERATE\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"12", "121", "0", "-5", "null"})
    @DisplayName("returns 400 for an age outside 13 to 120")
    void shouldRejectBadAge(String age) throws Exception {
        assertBadRequest(body("175", "\"cm\"", "72.5", "\"kg\"", age, "\"MALE\"", "\"MODERATE\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "-175.5", "null"})
    @DisplayName("returns 400 for a zero, negative or missing height")
    void shouldRejectBadHeight(String height) throws Exception {
        assertBadRequest(
                body(height, "\"cm\"", "72.5", "\"kg\"", "25", "\"MALE\"", "\"MODERATE\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "null"})
    @DisplayName("returns 400 for a zero, negative or missing weight")
    void shouldRejectBadWeight(String weight) throws Exception {
        assertBadRequest(body("175", "\"cm\"", weight, "\"kg\"", "25", "\"MALE\"", "\"MODERATE\""));
    }

    private void assertBadRequest(String json) throws Exception {
        mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(bodyStatsService);
    }
}
