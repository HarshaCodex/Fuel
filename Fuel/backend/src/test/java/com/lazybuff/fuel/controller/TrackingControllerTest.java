package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.TrackingService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
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
@DisplayName("TrackingController")
class TrackingControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String FOOD_ID = "22222222-2222-2222-2222-222222222222";
    private static final String URL = "/api/tracking/entries";

    @Mock private TrackingService trackingService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(new TrackingController(trackingService))
                        .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .build();
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                USER_ID.toString(), null, List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static String json(
            String foodId, String size, String unit, String quantity, String meal, String at) {
        return "{\"foodId\":%s,\"servingSize\":%s,\"servingUnit\":%s,\"quantity\":%s,"
                        .formatted(foodId, size, unit, quantity)
                + "\"mealLabel\":%s,\"loggedAt\":%s}".formatted(meal, at);
    }

    private static String valid() {
        return json(
                "\"" + FOOD_ID + "\"",
                "150.0",
                "\"g\"",
                "1.50",
                "\"lunch\"",
                "\"2026-06-09T12:30:00+05:30\"");
    }

    private static ApiResponse<TrackingEntryResponse> created() {
        return ApiResponse.<TrackingEntryResponse>builder()
                .status(HttpStatus.CREATED.value())
                .message("Entry logged")
                .data(
                        TrackingEntryResponse.builder()
                                .id(UUID.randomUUID())
                                .foodName("Chicken breast")
                                .source("USDA")
                                .servingUnit("g")
                                .calories(new BigDecimal("247.5"))
                                .build())
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("returns 201 with the body for the token's user")
    void shouldCreateEntryForTokenUser() throws Exception {
        when(trackingService.create(eq(USER_ID), any(TrackingEntryRequest.class)))
                .thenReturn(created());

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(valid()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(201))
                .andExpect(jsonPath("$.message").value("Entry logged"))
                .andExpect(jsonPath("$.data.foodName").value("Chicken breast"))
                .andExpect(jsonPath("$.data.servingUnit").value("g"));

        ArgumentCaptor<TrackingEntryRequest> captor =
                ArgumentCaptor.forClass(TrackingEntryRequest.class);
        verify(trackingService).create(eq(USER_ID), captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().getQuantity())
                .isEqualByComparingTo("1.5");
    }

    @Test
    @DisplayName("returns 201 when mealLabel and loggedAt are omitted")
    void shouldCreateEntryWithoutOptionalFields() throws Exception {
        when(trackingService.create(eq(USER_ID), any(TrackingEntryRequest.class)))
                .thenReturn(created());
        String body =
                "{\"foodId\":\""
                        + FOOD_ID
                        + "\",\"servingSize\":100,"
                        + "\"servingUnit\":\"g\",\"quantity\":1}";

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    static Stream<Arguments> invalidBodies() {
        String food = "\"" + FOOD_ID + "\"";
        return Stream.of(
                Arguments.of("missing foodId", json("null", "100", "\"g\"", "1", "null", "null")),
                Arguments.of("quantity 0", json(food, "100", "\"g\"", "0", "null", "null")),
                Arguments.of("quantity -1", json(food, "100", "\"g\"", "-1", "null", "null")),
                Arguments.of(
                        "quantity 4 digits", json(food, "100", "\"g\"", "1000", "null", "null")),
                Arguments.of("servingSize 0", json(food, "0", "\"g\"", "1", "null", "null")),
                Arguments.of("meal brunch", json(food, "100", "\"g\"", "1", "\"brunch\"", "null")),
                Arguments.of("unit kg", json(food, "100", "\"kg\"", "1", "null", "null")),
                Arguments.of("unit missing", json(food, "100", "null", "1", "null", "null")),
                Arguments.of(
                        "bad loggedAt", json(food, "100", "\"g\"", "1", "null", "\"yesterday\"")),
                Arguments.of(
                        "huge exponent", json(food, "1e999999999", "\"g\"", "1", "null", "null")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidBodies")
    @DisplayName("returns 400 and never calls the service for invalid input")
    void shouldReturnBadRequestForInvalidInput(String ignored, String body) throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("returns 404 when the service reports an unknown food")
    void shouldReturn404WhenFoodNotFound() throws Exception {
        when(trackingService.create(eq(USER_ID), any(TrackingEntryRequest.class)))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "Food item not found"));

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(valid()))
                .andExpect(status().isNotFound());
    }

    private static ApiResponse<List<TrackingEntryResponse>> listResponse() {
        return ApiResponse.<List<TrackingEntryResponse>>builder()
                .status(200)
                .message("Success")
                .data(List.of())
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET lists the entries of the requested date")
    void shouldListEntriesForDate() throws Exception {
        when(trackingService.listByDate(USER_ID, LocalDate.of(2026, 6, 9)))
                .thenReturn(listResponse());

        mockMvc.perform(get(URL).param("date", "2026-06-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("GET without a date passes null to the service")
    void shouldListEntriesWithoutDate() throws Exception {
        when(trackingService.listByDate(USER_ID, null)).thenReturn(listResponse());

        mockMvc.perform(get(URL)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-13-45", "abc"})
    @DisplayName("GET returns 400 for an invalid date")
    void shouldReturn400ForInvalidDate(String date) throws Exception {
        mockMvc.perform(get(URL).param("date", date)).andExpect(status().isBadRequest());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("DELETE returns 204")
    void shouldDeleteEntry() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete(URL + "/" + id)).andExpect(status().isNoContent());

        verify(trackingService).delete(USER_ID, id);
    }

    @Test
    @DisplayName("DELETE returns 400 for a malformed id")
    void shouldReturn400ForMalformedId() throws Exception {
        mockMvc.perform(delete(URL + "/not-a-uuid")).andExpect(status().isBadRequest());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("DELETE returns 404 when the service reports an unknown entry")
    void shouldReturn404WhenEntryNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(trackingService.delete(USER_ID, id))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "Entry not found"));

        mockMvc.perform(delete(URL + "/" + id)).andExpect(status().isNotFound());
    }
}
