package com.lazybuff.fuel.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DashboardResponse;
import com.lazybuff.fuel.dto.HistoryDayResponse;
import com.lazybuff.fuel.dto.StreakResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.dto.TrackingEntryUpdateRequest;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.DashboardService;
import com.lazybuff.fuel.service.HistoryService;
import com.lazybuff.fuel.service.StreakService;
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

    @Mock private StreakService streakService;

    @Mock private DashboardService dashboardService;

    @Mock private HistoryService historyService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(
                                new TrackingController(
                                        trackingService,
                                        streakService,
                                        dashboardService,
                                        historyService))
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

    private static ApiResponse<TrackingEntryResponse> updated() {
        return ApiResponse.<TrackingEntryResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Entry updated")
                .data(TrackingEntryResponse.builder().id(UUID.randomUUID()).build())
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("PUT returns 200 with the updated entry for the token's user")
    void shouldUpdateEntry() throws Exception {
        UUID id = UUID.randomUUID();
        when(trackingService.update(eq(USER_ID), eq(id), any(TrackingEntryUpdateRequest.class)))
                .thenReturn(updated());

        mockMvc.perform(
                        put(URL + "/" + id)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"servingSize\":200.0,\"quantity\":1,"
                                                + "\"mealLabel\":\"dinner\","
                                                + "\"loggedAt\":\"2026-06-09T12:30:00+05:30\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Entry updated"));

        ArgumentCaptor<TrackingEntryUpdateRequest> captor =
                ArgumentCaptor.forClass(TrackingEntryUpdateRequest.class);
        verify(trackingService).update(eq(USER_ID), eq(id), captor.capture());
        assertThat(captor.getValue().getServingSize()).isEqualTo(new BigDecimal("200"));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"quantity\":0}",
                "{\"quantity\":-1}",
                "{\"servingSize\":0}",
                "{\"mealLabel\":\"brunch\"}",
                "{\"loggedAt\":\"yesterday\"}",
                "{\"servingSize\":1e999999999}"
            })
    @DisplayName("PUT returns 400 for an invalid body")
    void shouldReturn400ForInvalidUpdateBody(String body) throws Exception {
        mockMvc.perform(
                        put(URL + "/" + UUID.randomUUID())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("PUT returns 400 for a malformed id")
    void shouldReturn400ForMalformedIdOnUpdate() throws Exception {
        mockMvc.perform(
                        put(URL + "/not-a-uuid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(trackingService);
    }

    @Test
    @DisplayName("PUT returns 404 when the service reports an unknown entry")
    void shouldReturn404OnUpdateWhenEntryNotFound() throws Exception {
        UUID id = UUID.randomUUID();
        when(trackingService.update(eq(USER_ID), eq(id), any(TrackingEntryUpdateRequest.class)))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "Entry not found"));

        mockMvc.perform(put(URL + "/" + id).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /streak returns the streak for the token's user")
    void shouldReturnStreakForAuthenticatedUser() throws Exception {
        when(streakService.get(USER_ID))
                .thenReturn(
                        ApiResponse.<StreakResponse>builder()
                                .status(200)
                                .message("Success")
                                .data(new StreakResponse(3, 7, LocalDate.of(2026, 11, 4)))
                                .timestamp(LocalDateTime.now())
                                .build());

        mockMvc.perform(get("/api/tracking/streak"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.current").value(3))
                .andExpect(jsonPath("$.data.longest").value(7))
                .andExpect(jsonPath("$.data.lastLoggedDate").value("2026-11-04"));
    }

    @Test
    @DisplayName("GET /streak returns 404 when the user is deleted")
    void shouldReturnNotFoundForStreakOfDeletedUser() throws Exception {
        when(streakService.get(USER_ID))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(get("/api/tracking/streak")).andExpect(status().isNotFound());
    }

    private static ApiResponse<DashboardResponse> dashboard(LocalDate day) {
        return ApiResponse.<DashboardResponse>builder()
                .status(200)
                .message("Success")
                .data(
                        new DashboardResponse(
                                day,
                                new DashboardResponse.Calories(
                                        new BigDecimal("500.5"), 2000, new BigDecimal("1499.5")),
                                new DashboardResponse.Macros(
                                        new DashboardResponse.Macro(
                                                new BigDecimal("30.1"), 150, "g"),
                                        new DashboardResponse.Macro(
                                                new BigDecimal("40.2"), 200, "g"),
                                        new DashboardResponse.Macro(
                                                new BigDecimal("10.3"), 65, "g")),
                                List.of(),
                                new StreakResponse(2, 5, day)))
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET /dashboard returns the dashboard shape for the requested date")
    void shouldReturnDashboardForRequestedDate() throws Exception {
        LocalDate day = LocalDate.of(2026, 11, 4);
        when(dashboardService.get(USER_ID, day)).thenReturn(dashboard(day));

        mockMvc.perform(get("/api/tracking/dashboard").param("date", "2026-11-04"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.date").value("2026-11-04"))
                .andExpect(jsonPath("$.data.calories.consumed").value(500.5))
                .andExpect(jsonPath("$.data.calories.goal").value(2000))
                .andExpect(jsonPath("$.data.calories.remaining").value(1499.5))
                .andExpect(jsonPath("$.data.macros.protein.unit").value("g"))
                .andExpect(jsonPath("$.data.macros.carbs.goal").value(200.0))
                .andExpect(jsonPath("$.data.macros.fat.consumed").value(10.3))
                .andExpect(jsonPath("$.data.entries").isEmpty())
                .andExpect(jsonPath("$.data.streak.current").value(2))
                .andExpect(jsonPath("$.data.streak.lastLoggedDate").value("2026-11-04"));
    }

    @Test
    @DisplayName("GET /dashboard without a date passes null so the service uses the user's today")
    void shouldPassNullDateWhenOmitted() throws Exception {
        when(dashboardService.get(USER_ID, null)).thenReturn(dashboard(LocalDate.of(2026, 11, 5)));

        mockMvc.perform(get("/api/tracking/dashboard")).andExpect(status().isOk());

        verify(dashboardService).get(USER_ID, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-13-45", "abc", "05-11-2026"})
    @DisplayName("GET /dashboard returns 400 for an invalid date")
    void shouldRejectInvalidDashboardDate(String date) throws Exception {
        mockMvc.perform(get("/api/tracking/dashboard").param("date", date))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(dashboardService);
    }

    @Test
    @DisplayName("GET /dashboard returns 404 when the user is deleted")
    void shouldReturnNotFoundForDashboardOfDeletedUser() throws Exception {
        when(dashboardService.get(USER_ID, null))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(get("/api/tracking/dashboard")).andExpect(status().isNotFound());
    }

    private static ApiResponse<List<HistoryDayResponse>> history() {
        return ApiResponse.<List<HistoryDayResponse>>builder()
                .status(200)
                .message("Success")
                .data(
                        List.of(
                                new HistoryDayResponse(
                                        LocalDate.of(2026, 6, 9),
                                        new BigDecimal("1450.5"),
                                        2200,
                                        new BigDecimal("120.5"),
                                        new BigDecimal("140.0"),
                                        new BigDecimal("45.2"),
                                        new BigDecimal("18.0"),
                                        6),
                                new HistoryDayResponse(
                                        LocalDate.of(2026, 6, 8),
                                        new BigDecimal("900"),
                                        2200,
                                        new BigDecimal("50"),
                                        new BigDecimal("80"),
                                        new BigDecimal("20"),
                                        new BigDecimal("5"),
                                        2)))
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET /history returns the rows in the contract shape")
    void shouldReturnHistoryShape() throws Exception {
        LocalDate from = LocalDate.of(2026, 6, 1);
        LocalDate to = LocalDate.of(2026, 6, 9);
        when(historyService.get(USER_ID, from, to)).thenReturn(history());

        mockMvc.perform(
                        get("/api/tracking/history")
                                .param("from", "2026-06-01")
                                .param("to", "2026-06-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data[0].date").value("2026-06-09"))
                .andExpect(jsonPath("$.data[0].calories").value(1450.5))
                .andExpect(jsonPath("$.data[0].calorieGoal").value(2200))
                .andExpect(jsonPath("$.data[0].protein").value(120.5))
                .andExpect(jsonPath("$.data[0].carbs").value(140.0))
                .andExpect(jsonPath("$.data[0].fat").value(45.2))
                .andExpect(jsonPath("$.data[0].fiber").value(18.0))
                .andExpect(jsonPath("$.data[0].entryCount").value(6))
                .andExpect(jsonPath("$.data[1].date").value("2026-06-08"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-13-45", "abc", "09-06-2026"})
    @DisplayName("GET /history returns 400 for an invalid from date")
    void shouldRejectInvalidHistoryFrom(String from) throws Exception {
        mockMvc.perform(get("/api/tracking/history").param("from", from).param("to", "2026-06-09"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(historyService);
    }

    @Test
    @DisplayName("GET /history returns 400 for an invalid to date")
    void shouldRejectInvalidHistoryTo() throws Exception {
        mockMvc.perform(
                        get("/api/tracking/history")
                                .param("from", "2026-06-01")
                                .param("to", "2026-13-45"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(historyService);
    }

    @Test
    @DisplayName("GET /history returns 400 when from is missing")
    void shouldRejectHistoryWithoutFrom() throws Exception {
        mockMvc.perform(get("/api/tracking/history").param("to", "2026-06-09"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(historyService);
    }

    @Test
    @DisplayName("GET /history returns 400 when to is missing")
    void shouldRejectHistoryWithoutTo() throws Exception {
        mockMvc.perform(get("/api/tracking/history").param("from", "2026-06-01"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(historyService);
    }

    @Test
    @DisplayName("GET /history maps a range error from the service to 400")
    void shouldMapHistoryRangeErrorToBadRequest() throws Exception {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 6, 9);
        when(historyService.get(USER_ID, from, to))
                .thenThrow(
                        new FuelException(
                                HttpStatus.BAD_REQUEST, "Date range must not exceed 90 days"));

        mockMvc.perform(
                        get("/api/tracking/history")
                                .param("from", "2026-01-01")
                                .param("to", "2026-06-09"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /history returns 404 when the user is deleted")
    void shouldReturnNotFoundForHistoryOfDeletedUser() throws Exception {
        LocalDate day = LocalDate.of(2026, 6, 9);
        when(historyService.get(USER_ID, day, day))
                .thenThrow(new FuelException(HttpStatus.NOT_FOUND, "User not found"));

        mockMvc.perform(
                        get("/api/tracking/history")
                                .param("from", "2026-06-09")
                                .param("to", "2026-06-09"))
                .andExpect(status().isNotFound());
    }
}
