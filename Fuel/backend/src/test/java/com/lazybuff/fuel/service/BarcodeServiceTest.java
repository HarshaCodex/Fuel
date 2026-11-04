package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.RateLimitExceededException;
import com.lazybuff.fuel.mapper.FoodItemToFoodItemDetailMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.service.OffClient.OffFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaFood;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("BarcodeService")
class BarcodeServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FOOD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final String EAN = "0023700011527";
    private static final String UPC = "023700011527";
    private static final String KEY = "food:barcode:" + EAN;

    @Mock private OffClient offClient;
    @Mock private UsdaClient usdaClient;
    @Mock private FoodItemRepository foodItemRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private RateLimiterService rateLimiterService;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    private BarcodeService service;

    @BeforeEach
    void setUp() {
        FoodSearchConfig config = new FoodSearchConfig();
        config.getBarcode().setCacheTtl(Duration.ofDays(7));
        config.getBarcode().setRateLimit(30);
        config.getBarcode().setRateLimitWindow(Duration.ofMinutes(1));
        service =
                new BarcodeService(
                        offClient,
                        usdaClient,
                        foodItemRepository,
                        Mappers.getMapper(FoodItemToFoodItemDetailMapper.class),
                        redisTemplate,
                        new TransactionTemplate(transactionManager),
                        config,
                        jsonMapper,
                        rateLimiterService);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    private static OffFood offFood() {
        return new OffFood(
                UPC,
                UPC,
                "Oats",
                "Brand",
                new BigDecimal("370"),
                new BigDecimal("13"),
                new BigDecimal("60"),
                new BigDecimal("7"),
                new BigDecimal("10"));
    }

    private static UsdaFood usdaFood() {
        return new UsdaFood(
                5L,
                "5",
                "Oats USDA",
                "Brand",
                new BigDecimal("370"),
                new BigDecimal("13"),
                new BigDecimal("60"),
                new BigDecimal("7"),
                new BigDecimal("10"));
    }

    private static FoodItem item(String name) {
        FoodItem item = new FoodItem();
        item.setId(FOOD_ID);
        item.setName(name);
        item.setBarcode(EAN);
        return item;
    }

    private void givenSavedRows() {
        lenient()
                .when(
                        foodItemRepository.upsertOffFood(
                                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                                any()))
                .thenReturn(FOOD_ID);
        lenient()
                .when(
                        foodItemRepository.upsertUsdaFood(
                                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                                any()))
                .thenReturn(FOOD_ID);
        lenient()
                .when(foodItemRepository.findWithServingSizesById(FOOD_ID))
                .thenReturn(Optional.of(item("Saved")));
    }

    private void givenCacheMissAndNoLocalRow() {
        when(valueOperations.get(KEY)).thenReturn(null);
        when(foodItemRepository.findSharedByBarcode(EAN)).thenReturn(Optional.empty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"1234567", "123456789012345", "abcdefgh", "1234 5678", "12345678%0A"})
    @DisplayName("rejects a malformed barcode with 400 and no lookups")
    void shouldRejectMalformedBarcode(String code) {
        assertThatThrownBy(() -> service.lookup(USER_ID, code))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(offClient, usdaClient, foodItemRepository, redisTemplate);
    }

    @Test
    @DisplayName("canonicalises UPC-A and EAN-13 to one 13-digit form and keeps 14 digits")
    void shouldCanonicaliseBarcodes() {
        assertThat(BarcodeService.canonical(UPC)).isEqualTo(EAN);
        assertThat(BarcodeService.canonical(EAN)).isEqualTo(EAN);
        assertThat(BarcodeService.canonical("12345678")).isEqualTo("0000012345678");
        assertThat(BarcodeService.canonical("12345678901234")).isEqualTo("12345678901234");
    }

    @Test
    @DisplayName("serves a cache hit without touching the table, clients or rate limiter")
    void shouldServeCacheHit() throws Exception {
        when(valueOperations.get(KEY))
                .thenReturn(
                        jsonMapper.writeValueAsString(
                                FoodItemDetail.builder().id(FOOD_ID).name("Cached").build()));

        ApiResponse<FoodItemDetail> response = service.lookup(USER_ID, UPC);

        assertThat(response.getData().getName()).isEqualTo("Cached");
        verifyNoInteractions(offClient, usdaClient, foodItemRepository, rateLimiterService);
    }

    @Test
    @DisplayName("serves a local hit for free and writes the cache")
    void shouldServeLocalHit() {
        when(valueOperations.get(KEY)).thenReturn(null);
        when(foodItemRepository.findSharedByBarcode(EAN)).thenReturn(Optional.of(item("Local")));
        when(foodItemRepository.findWithServingSizesById(FOOD_ID))
                .thenReturn(Optional.of(item("Local")));

        ApiResponse<FoodItemDetail> response = service.lookup(USER_ID, UPC);

        assertThat(response.getData().getName()).isEqualTo("Local");
        verify(valueOperations).set(eq(KEY), anyString(), eq(Duration.ofDays(7)));
        verifyNoInteractions(offClient, usdaClient, rateLimiterService);
    }

    @Test
    @DisplayName("serves from the table when Redis is down, without an outbound call")
    void shouldServeFromTableWhenRedisDown() {
        when(valueOperations.get(KEY)).thenThrow(new RedisConnectionFailureException("down"));
        doThrow(new RedisConnectionFailureException("down"))
                .when(valueOperations)
                .set(anyString(), anyString(), any(Duration.class));
        when(foodItemRepository.findSharedByBarcode(EAN)).thenReturn(Optional.of(item("Local")));
        when(foodItemRepository.findWithServingSizesById(FOOD_ID))
                .thenReturn(Optional.of(item("Local")));

        assertThat(service.lookup(USER_ID, EAN).getData().getName()).isEqualTo("Local");

        verifyNoInteractions(offClient, usdaClient);
    }

    @Test
    @DisplayName("saves an OFF match with its canonical barcode and caches it")
    void shouldSaveOffMatch() {
        givenCacheMissAndNoLocalRow();
        givenSavedRows();
        when(offClient.findByBarcode(EAN)).thenReturn(Optional.of(offFood()));

        ApiResponse<FoodItemDetail> response = service.lookup(USER_ID, UPC);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getData().getName()).isEqualTo("Saved");
        verify(foodItemRepository).setBarcode(FOOD_ID, EAN);
        verify(valueOperations).set(eq(KEY), anyString(), eq(Duration.ofDays(7)));
        verifyNoInteractions(usdaClient);
    }

    @Test
    @DisplayName("falls back to USDA when OFF has no match")
    void shouldFallBackToUsda() {
        givenCacheMissAndNoLocalRow();
        givenSavedRows();
        when(offClient.findByBarcode(EAN)).thenReturn(Optional.empty());
        when(usdaClient.findByGtin(EAN)).thenReturn(Optional.of(usdaFood()));

        assertThat(service.lookup(USER_ID, EAN).getStatus()).isEqualTo(200);

        verify(foodItemRepository).setBarcode(FOOD_ID, EAN);
        verify(foodItemRepository, never())
                .upsertOffFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("returns the USDA match when OFF is down")
    void shouldReturnUsdaWhenOffFails() {
        givenCacheMissAndNoLocalRow();
        givenSavedRows();
        when(offClient.findByBarcode(EAN))
                .thenThrow(new FuelException(HttpStatus.SERVICE_UNAVAILABLE, "down"));
        when(usdaClient.findByGtin(EAN)).thenReturn(Optional.of(usdaFood()));

        assertThat(service.lookup(USER_ID, EAN).getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("returns 404 and caches nothing when every source answers with no match")
    void shouldReturnNotFoundWhenNoSourceHasIt() {
        givenCacheMissAndNoLocalRow();
        when(offClient.findByBarcode(EAN)).thenReturn(Optional.empty());
        when(usdaClient.findByGtin(EAN)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lookup(USER_ID, EAN))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo("Food item not found");
                        });

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("rethrows the USDA failure, not a 404, when OFF is empty and USDA fails")
    void shouldRethrowUsdaFailureWhenOffEmpty() {
        givenCacheMissAndNoLocalRow();
        when(offClient.findByBarcode(EAN)).thenReturn(Optional.empty());
        when(usdaClient.findByGtin(EAN))
                .thenThrow(new FuelException(HttpStatus.SERVICE_UNAVAILABLE, "usda down"));

        assertThatThrownBy(() -> service.lookup(USER_ID, EAN))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e ->
                                assertThat(e.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("rethrows the OFF failure, not a 404, when USDA is empty")
    void shouldRethrowOffFailureWhenUsdaEmpty() {
        givenCacheMissAndNoLocalRow();
        when(offClient.findByBarcode(EAN))
                .thenThrow(new FuelException(HttpStatus.BAD_GATEWAY, "off"));
        when(usdaClient.findByGtin(EAN)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lookup(USER_ID, EAN))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    @DisplayName("rethrows the USDA failure when both sources fail")
    void shouldRethrowUsdaFailureWhenBothFail() {
        givenCacheMissAndNoLocalRow();
        when(offClient.findByBarcode(EAN))
                .thenThrow(new FuelException(HttpStatus.BAD_GATEWAY, "off"));
        when(usdaClient.findByGtin(EAN))
                .thenThrow(new FuelException(HttpStatus.SERVICE_UNAVAILABLE, "usda"));

        assertThatThrownBy(() -> service.lookup(USER_ID, EAN))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e ->
                                assertThat(e.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }

    @Test
    @DisplayName("returns 429 on a miss when rate limited, before any outbound call")
    void shouldRateLimitBeforeOutboundCalls() {
        givenCacheMissAndNoLocalRow();
        doThrow(new RateLimitExceededException("Too many barcode lookups.", Duration.ofSeconds(30)))
                .when(rateLimiterService)
                .enforce(eq("food-barcode:" + USER_ID), eq(30), eq(Duration.ofMinutes(1)), any());

        assertThatThrownBy(() -> service.lookup(USER_ID, EAN))
                .isInstanceOf(RateLimitExceededException.class);

        verifyNoInteractions(offClient, usdaClient);
    }
}
