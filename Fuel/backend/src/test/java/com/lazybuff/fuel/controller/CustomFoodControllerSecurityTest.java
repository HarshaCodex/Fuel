package com.lazybuff.fuel.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.config.IpRateLimitConfig;
import com.lazybuff.fuel.config.SecurityConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.dto.PageResponse;
import com.lazybuff.fuel.exception.GlobalExceptionHandler;
import com.lazybuff.fuel.logging.RequestIdFilter;
import com.lazybuff.fuel.security.RestAccessDeniedHandler;
import com.lazybuff.fuel.security.RestAuthEntryPoint;
import com.lazybuff.fuel.service.CustomFoodService;
import com.lazybuff.fuel.service.FoodService;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.RateLimiterService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Full filter chain and method validation, which the standalone controller tests skip. */
@WebMvcTest(FoodItemController.class)
@Import({
    SecurityConfig.class,
    RestAuthEntryPoint.class,
    RestAccessDeniedHandler.class,
    IpRateLimitConfig.class,
    RequestIdFilter.class,
    GlobalExceptionHandler.class
})
@DisplayName("FoodItemController custom food security and routing")
class CustomFoodControllerSecurityTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String URL = "/api/food/custom";
    private static final String BODY =
            "{\"name\":\"Dal\",\"servingSize\":200,\"servingUnit\":\"g\",\"calories\":180,"
                    + "\"protein\":9,\"carbs\":24,\"fat\":5}";

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtService jwtService;

    @MockitoBean private CustomFoodService customFoodService;

    @MockitoBean private FoodService foodService;

    // WebConfig needs it to register rate-limit interceptors.
    @MockitoBean private RateLimiterService rateLimiterService;

    @SuppressWarnings("unchecked")
    private void givenValidToken() {
        Jws<Claims> jws = mock(Jws.class);
        Claims claims = mock(Claims.class);
        when(jws.getPayload()).thenReturn(claims);
        when(claims.getSubject()).thenReturn(USER_ID.toString());
        when(jwtService.parseAndValidate("good")).thenReturn(jws);
    }

    private static ApiResponse<PageResponse<CustomFoodResponse>> emptyPage() {
        return ApiResponse.<PageResponse<CustomFoodResponse>>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(
                        PageResponse.<CustomFoodResponse>builder()
                                .content(List.of())
                                .page(0)
                                .size(20)
                                .totalElements(0)
                                .totalPages(0)
                                .build())
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("returns 401 for listing custom foods without an access token")
    void shouldReturnUnauthorizedWhenListingWithoutToken() throws Exception {
        mockMvc.perform(get(URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("returns 401 for creating a custom food without an access token")
    void shouldReturnUnauthorizedWhenCreatingWithoutToken() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("returns 401 for an invalid access token")
    void shouldReturnUnauthorizedForInvalidToken() throws Exception {
        when(jwtService.parseAndValidate("bad"))
                .thenThrow(new io.jsonwebtoken.JwtException("invalid"));

        mockMvc.perform(get(URL).header("Authorization", "Bearer bad"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(customFoodService);
    }

    @Test
    @DisplayName("lists with the token's user id and the default page 0 and size 20")
    void shouldListForTokenUserWithDefaults() throws Exception {
        givenValidToken();
        when(customFoodService.list(USER_ID, 0, 20)).thenReturn(emptyPage());

        mockMvc.perform(get(URL).header("Authorization", "Bearer good"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.totalPages").value(0));

        verify(customFoodService).list(USER_ID, 0, 20);
    }

    @Test
    @DisplayName("routes GET /custom to the list endpoint, not to GET /{id}")
    void shouldRouteCustomToListNotToIdLookup() throws Exception {
        givenValidToken();
        when(customFoodService.list(eq(USER_ID), anyInt(), anyInt())).thenReturn(emptyPage());

        mockMvc.perform(get(URL).header("Authorization", "Bearer good")).andExpect(status().isOk());

        verify(customFoodService).list(eq(USER_ID), anyInt(), anyInt());
        verifyNoInteractions(foodService);
    }

    @Test
    @DisplayName("creates for the token's user id")
    void shouldCreateForTokenUser() throws Exception {
        givenValidToken();
        when(customFoodService.create(eq(USER_ID), any(CustomFoodRequest.class)))
                .thenReturn(
                        ApiResponse.<CustomFoodResponse>builder()
                                .status(HttpStatus.CREATED.value())
                                .message("Custom food created")
                                .data(CustomFoodResponse.builder().name("Dal").build())
                                .timestamp(LocalDateTime.now())
                                .build());

        mockMvc.perform(
                        post(URL)
                                .header("Authorization", "Bearer good")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("Dal"));

        verify(customFoodService).create(eq(USER_ID), any(CustomFoodRequest.class));
    }

    @ParameterizedTest
    @CsvSource({"-1,20", "0,0", "0,51", "0,-5"})
    @DisplayName("returns 400 for a negative page or a size outside 1 to 50")
    void shouldReturnBadRequestForInvalidPaging(String page, String size) throws Exception {
        givenValidToken();

        mockMvc.perform(
                        get(URL).param("page", page)
                                .param("size", size)
                                .header("Authorization", "Bearer good"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(customFoodService);
    }

    @ParameterizedTest
    @CsvSource({"abc,20", "0,x"})
    @DisplayName("returns 400 for non-numeric paging")
    void shouldReturnBadRequestForNonNumericPaging(String page, String size) throws Exception {
        givenValidToken();

        mockMvc.perform(
                        get(URL).param("page", page)
                                .param("size", size)
                                .header("Authorization", "Bearer good"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(customFoodService);
    }

    @ParameterizedTest
    @CsvSource({"0,1", "3,50"})
    @DisplayName("accepts the paging boundaries")
    void shouldAcceptPagingBoundaries(int page, int size) throws Exception {
        givenValidToken();
        when(customFoodService.list(USER_ID, page, size)).thenReturn(emptyPage());

        mockMvc.perform(
                        get(URL).param("page", String.valueOf(page))
                                .param("size", String.valueOf(size))
                                .header("Authorization", "Bearer good"))
                .andExpect(status().isOk());
    }
}
