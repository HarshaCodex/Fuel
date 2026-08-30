package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.service.FoodService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
@DisplayName("FoodItemController")
class FoodItemControllerTest {

    private static final UUID FOOD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock private FoodService foodService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FoodItemController(foodService)).build();
    }

    private static ApiResponse<FoodItemDetail> okResponse() {
        return ApiResponse.<FoodItemDetail>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(
                        FoodItemDetail.builder()
                                .id(FOOD_ID)
                                .name("Rolled Oats")
                                .servingUnit("g")
                                .servingSize(new BigDecimal("40.0"))
                                .build())
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Nested
    @DisplayName("GET /api/food/{id}")
    class GetFood {

        @Test
        @DisplayName("returns the service response body rather than an empty 200")
        void returnsServiceResponse() throws Exception {
            when(foodService.getFoodById(FOOD_ID)).thenReturn(okResponse());

            mockMvc.perform(get("/api/food/{id}", FOOD_ID))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(200))
                    .andExpect(jsonPath("$.message").value("Success"))
                    .andExpect(jsonPath("$.data.id").value(FOOD_ID.toString()))
                    .andExpect(jsonPath("$.data.name").value("Rolled Oats"))
                    .andExpect(jsonPath("$.data.servingUnit").value("g"));
        }

        @Test
        @DisplayName("binds the path variable and delegates to the service")
        void delegatesToService() throws Exception {
            when(foodService.getFoodById(FOOD_ID)).thenReturn(okResponse());

            mockMvc.perform(get("/api/food/{id}", FOOD_ID));

            verify(foodService).getFoodById(FOOD_ID);
        }
    }

    @Nested
    @DisplayName("unsupported methods")
    class UnsupportedMethods {

        @Test
        @DisplayName("rejects POST, PUT and DELETE on the same path")
        void rejectsWriteMethods() throws Exception {
            mockMvc.perform(post("/api/food/{id}", FOOD_ID))
                    .andExpect(status().isMethodNotAllowed());
            mockMvc.perform(put("/api/food/{id}", FOOD_ID))
                    .andExpect(status().isMethodNotAllowed());
            mockMvc.perform(delete("/api/food/{id}", FOOD_ID))
                    .andExpect(status().isMethodNotAllowed());

            verify(foodService, never()).getFoodById(any(UUID.class));
        }
    }
}
