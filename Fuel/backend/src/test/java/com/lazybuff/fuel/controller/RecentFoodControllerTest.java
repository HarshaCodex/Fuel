package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.RecentFoodItem;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.BarcodeService;
import com.lazybuff.fuel.service.CustomFoodService;
import com.lazybuff.fuel.service.FoodSearchService;
import com.lazybuff.fuel.service.FoodService;
import com.lazybuff.fuel.service.RecentFoodService;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@DisplayName("FoodItemController GET /api/food/recent")
class RecentFoodControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FOOD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock private FoodService foodService;
    @Mock private CustomFoodService customFoodService;
    @Mock private FoodSearchService foodSearchService;
    @Mock private BarcodeService barcodeService;
    @Mock private RecentFoodService recentFoodService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(
                                new FoodItemController(
                                        foodService,
                                        customFoodService,
                                        foodSearchService,
                                        barcodeService,
                                        recentFoodService))
                        .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                        .setControllerAdvice(new GlobalExceptionHandler())
                        .build();
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                USER_ID.toString(), null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static ApiResponse<List<RecentFoodItem>> response(List<RecentFoodItem> items) {
        return ApiResponse.<List<RecentFoodItem>>builder()
                .status(200)
                .message("Success")
                .data(items)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("uses the default limit of 10 and the caller's id")
    void shouldUseDefaultLimit() throws Exception {
        when(recentFoodService.recent(USER_ID, 10)).thenReturn(response(List.of()));

        mockMvc.perform(get("/api/food/recent")).andExpect(status().isOk());

        verify(recentFoodService).recent(USER_ID, 10);
    }

    @Test
    @DisplayName("returns the documented JSON shape")
    void shouldReturnJsonShape() throws Exception {
        when(recentFoodService.recent(USER_ID, 10))
                .thenReturn(
                        response(
                                List.of(
                                        new RecentFoodItem(
                                                FOOD_ID,
                                                "Oats",
                                                "Quaker",
                                                "USDA",
                                                new BigDecimal("40"),
                                                "g",
                                                new BigDecimal("150"),
                                                new BigDecimal("5"),
                                                new BigDecimal("27"),
                                                new BigDecimal("3"),
                                                OffsetDateTime.parse("2026-01-10T12:00:00Z")))));

        mockMvc.perform(get("/api/food/recent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data[0].id").value(FOOD_ID.toString()))
                .andExpect(jsonPath("$.data[0].name").value("Oats"))
                .andExpect(jsonPath("$.data[0].brand").value("Quaker"))
                .andExpect(jsonPath("$.data[0].source").value("USDA"))
                .andExpect(jsonPath("$.data[0].servingSize").value(40))
                .andExpect(jsonPath("$.data[0].servingUnit").value("g"))
                .andExpect(jsonPath("$.data[0].calories").value(150))
                .andExpect(jsonPath("$.data[0].protein").value(5))
                .andExpect(jsonPath("$.data[0].carbs").value(27))
                .andExpect(jsonPath("$.data[0].fat").value(3))
                .andExpect(jsonPath("$.data[0].lastLoggedAt").exists());
    }

    @Test
    @DisplayName("returns data as an empty array when nothing was logged")
    void shouldReturnEmptyArray() throws Exception {
        when(recentFoodService.recent(USER_ID, 10)).thenReturn(response(List.of()));

        mockMvc.perform(get("/api/food/recent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "30"})
    @DisplayName("accepts the limit boundaries 1 and 30")
    void shouldAcceptBoundaryLimits(String limit) throws Exception {
        when(recentFoodService.recent(USER_ID, Integer.parseInt(limit)))
                .thenReturn(response(List.of()));

        mockMvc.perform(get("/api/food/recent").param("limit", limit)).andExpect(status().isOk());

        verify(recentFoodService).recent(USER_ID, Integer.parseInt(limit));
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "1.5"})
    @DisplayName("rejects a non-numeric limit with 400")
    void shouldRejectNonNumericLimit(String limit) throws Exception {
        mockMvc.perform(get("/api/food/recent").param("limit", limit))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(recentFoodService);
    }

    @Test
    @DisplayName("routes /recent to the recents handler and does not parse it as a food id")
    void shouldRouteRecentBeforeIdPath() throws Exception {
        when(recentFoodService.recent(any(), anyInt())).thenReturn(response(List.of()));

        mockMvc.perform(get("/api/food/recent")).andExpect(status().isOk());

        verifyNoInteractions(foodService);
    }
}
