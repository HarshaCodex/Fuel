package com.lazybuff.fuel.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.service.CustomFoodService;
import com.lazybuff.fuel.service.FoodService;
import java.math.BigDecimal;
import java.time.Duration;
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

/** Body validation for POST /api/food/custom. Query-param limits live in the security test. */
@ExtendWith(MockitoExtension.class)
@DisplayName("FoodItemController custom food creation")
class CustomFoodControllerTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String URL = "/api/food/custom";

    @Mock private FoodService foodService;

    @Mock private CustomFoodService customFoodService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc =
                MockMvcBuilders.standaloneSetup(
                                new FoodItemController(foodService, customFoodService))
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
            String name,
            String brand,
            String size,
            String unit,
            String calories,
            String protein,
            String carbs,
            String fat,
            String fiber) {
        return """
                {"name":%s,"brand":%s,"servingSize":%s,"servingUnit":%s,"calories":%s,\
                "protein":%s,"carbs":%s,"fat":%s,"fiber":%s}
                """
                .formatted(name, brand, size, unit, calories, protein, carbs, fat, fiber);
    }

    private static String valid() {
        return json("\"Dal\"", "null", "200", "\"g\"", "180", "9.0", "24.0", "5.0", "4.0");
    }

    private static String quoted(int length) {
        return "\"" + "a".repeat(length) + "\"";
    }

    private static Stream<Arguments> invalidBodies() {
        return Stream.of(
                Arguments.of(
                        "blank name",
                        json("\"  \"", "null", "200", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "missing name",
                        json("null", "null", "200", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "201 char name",
                        json(quoted(201), "null", "200", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "201 char brand",
                        json("\"Dal\"", quoted(201), "200", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "missing servingSize",
                        json("\"Dal\"", "null", "null", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "zero servingSize",
                        json("\"Dal\"", "null", "0", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "negative servingSize",
                        json("\"Dal\"", "null", "-5", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "servingSize 2 decimals",
                        json("\"Dal\"", "null", "1.25", "\"g\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "missing unit",
                        json("\"Dal\"", "null", "200", "null", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "unknown unit",
                        json("\"Dal\"", "null", "200", "\"kg\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "uppercase unit",
                        json("\"Dal\"", "null", "200", "\"G\"", "1", "1", "1", "1", "1")),
                Arguments.of(
                        "missing calories",
                        json("\"Dal\"", "null", "200", "\"g\"", "null", "1", "1", "1", "1")),
                Arguments.of(
                        "negative calories",
                        json("\"Dal\"", "null", "200", "\"g\"", "-1", "1", "1", "1", "1")),
                Arguments.of(
                        "calories too many digits",
                        json("\"Dal\"", "null", "200", "\"g\"", "1000000", "1", "1", "1", "1")),
                Arguments.of(
                        "missing protein",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "null", "1", "1", "1")),
                Arguments.of(
                        "negative protein",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "-0.1", "1", "1", "1")),
                Arguments.of(
                        "protein too many digits",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "100000", "1", "1", "1")),
                Arguments.of(
                        "missing carbs",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "null", "1", "1")),
                Arguments.of(
                        "negative carbs",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "-1", "1", "1")),
                Arguments.of(
                        "missing fat",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "1", "null", "1")),
                Arguments.of(
                        "negative fat",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "1", "-1", "1")),
                Arguments.of(
                        "negative fiber",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "1", "1", "-1")),
                Arguments.of(
                        "fiber 3 decimals",
                        json("\"Dal\"", "null", "200", "\"g\"", "1", "1", "1", "1", "1.001")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidBodies")
    @DisplayName("returns 400 and never calls the service for invalid input")
    void shouldReturnBadRequestForInvalidInput(String ignored, String body) throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("returns 400 for malformed JSON")
    void shouldReturnBadRequestForMalformedJson() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"name\":"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("returns 400 for an empty body")
    void shouldReturnBadRequestForEmptyBody() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("accepts a 200 character name, zero nutrients and no fiber")
    void shouldAcceptBoundaryValues() throws Exception {
        when(customFoodService.create(eq(USER_ID), any(CustomFoodRequest.class)))
                .thenReturn(created());
        String body = json(quoted(200), "null", "0.1", "\"serving\"", "0", "0", "0", "0", "null");

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("returns 400 quickly for a huge exponent instead of expanding it")
    void shouldRejectHugeExponentWithoutExpandingIt() throws Exception {
        String body = json("\"Dal\"", "null", "200", "\"g\"", "1e999999999", "9", "24", "5", "4");

        assertTimeoutPreemptively(
                Duration.ofSeconds(2),
                () ->
                        mockMvc.perform(
                                        post(URL)
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(body))
                                .andExpect(status().isBadRequest()));
        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("accepts values with trailing zeros such as 200.00")
    void shouldAcceptTrailingZeros() throws Exception {
        when(customFoodService.create(eq(USER_ID), any(CustomFoodRequest.class)))
                .thenReturn(created());
        String body =
                json(
                        "\"Dal\"", "null", "200.00", "\"g\"", "180.00", "9.50", "24.00", "5.00",
                        "4.00");

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("returns 201 with the created food and passes the token's user id")
    void shouldReturnCreatedWithFoodAndTokenUser() throws Exception {
        when(customFoodService.create(eq(USER_ID), any(CustomFoodRequest.class)))
                .thenReturn(created());

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(valid()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(201))
                .andExpect(jsonPath("$.message").value("Custom food created"))
                .andExpect(jsonPath("$.data.name").value("Dal"))
                .andExpect(jsonPath("$.data.source").value("USER"))
                .andExpect(jsonPath("$.data.createdBy").value(USER_ID.toString()));
    }

    @Test
    @DisplayName("ignores owner, source and id fields sent in the body")
    void shouldIgnoreOwnerFieldsInBody() throws Exception {
        when(customFoodService.create(eq(USER_ID), any(CustomFoodRequest.class)))
                .thenReturn(created());
        String body =
                valid().replace(
                                "{",
                                "{\"createdBy\":\"22222222-2222-2222-2222-222222222222\","
                                        + "\"source\":\"USDA\",\"id\":\"33333333-3333-3333-3333-333333333333\",");

        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        ArgumentCaptor<UUID> owner = ArgumentCaptor.forClass(UUID.class);
        verify(customFoodService).create(owner.capture(), any(CustomFoodRequest.class));
        assertThat(owner.getValue()).isEqualTo(USER_ID);
    }

    private static ApiResponse<CustomFoodResponse> created() {
        CustomFoodResponse data =
                CustomFoodResponse.builder()
                        .id(UUID.randomUUID())
                        .name("Dal")
                        .source("USER")
                        .servingSize(new BigDecimal("200"))
                        .servingUnit("g")
                        .createdBy(USER_ID)
                        .build();
        return ApiResponse.<CustomFoodResponse>builder()
                .status(HttpStatus.CREATED.value())
                .message("Custom food created")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
