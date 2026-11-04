package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodSearchItem;
import com.lazybuff.fuel.dto.PageResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.RateLimitExceededException;
import com.lazybuff.fuel.mapper.FoodSearchMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.service.UsdaClient.UsdaFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaPage;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
@DisplayName("FoodSearchService")
class FoodSearchServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USDA_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock private UsdaClient usdaClient;
    @Mock private FoodItemRepository foodItemRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private RateLimiterService rateLimiterService;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    private FoodSearchService service;

    @BeforeEach
    void setUp() {
        FoodSearchConfig config = new FoodSearchConfig();
        config.getSearch().setCacheTtl(Duration.ofHours(24));
        config.getSearch().setMaxCustomResults(10);
        config.getSearch().setRateLimit(30);
        config.getSearch().setRateLimitWindow(Duration.ofMinutes(1));
        service =
                new FoodSearchService(
                        usdaClient,
                        foodItemRepository,
                        Mappers.getMapper(FoodSearchMapper.class),
                        redisTemplate,
                        new TransactionTemplate(transactionManager),
                        config,
                        jsonMapper,
                        rateLimiterService);
        org.mockito.Mockito.lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    private static UsdaFood usdaFood() {
        return new UsdaFood(
                171077L,
                "171077",
                "Chicken breast",
                null,
                new BigDecimal("165.0"),
                new BigDecimal("31.02"),
                new BigDecimal("0.00"),
                new BigDecimal("3.60"),
                new BigDecimal("0.00"));
    }

    private void givenUsdaReturnsOneFood() {
        when(usdaClient.search(anyString(), anyInt(), anyInt()))
                .thenReturn(new UsdaPage(List.of(usdaFood()), 42, 3));
        when(foodItemRepository.upsertUsdaFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(USDA_ID);
    }

    private static FoodItem customFood() {
        return FoodItem.builder()
                .id(UUID.randomUUID())
                .name("My chicken")
                .source(FoodSource.USER)
                .servingSize(new BigDecimal("150"))
                .servingUnit(ServingUnit.G)
                .calories(new BigDecimal("200"))
                .protein(new BigDecimal("20"))
                .carbs(new BigDecimal("1"))
                .fat(new BigDecimal("5"))
                .fiber(BigDecimal.ZERO)
                .build();
    }

    @Test
    @DisplayName("fetches, saves and caches for 24h on a cache miss")
    void shouldFetchSaveAndCacheOnMiss() {
        givenUsdaReturnsOneFood();

        ApiResponse<PageResponse<FoodSearchItem>> response =
                service.search(USER_ID, "  chicken ", 0, 20);

        PageResponse<FoodSearchItem> data = response.getData();
        assertThat(data.getContent()).hasSize(1);
        FoodSearchItem item = data.getContent().getFirst();
        assertThat(item.id()).isEqualTo(USDA_ID);
        assertThat(item.source()).isEqualTo("USDA");
        assertThat(item.servingSize()).isEqualByComparingTo("100");
        assertThat(item.servingUnit()).isEqualTo("g");
        assertThat(data.getTotalElements()).isEqualTo(42);
        assertThat(data.getTotalPages()).isEqualTo(3);
        verify(usdaClient).search("chicken", 0, 20);
        verify(valueOperations)
                .set(
                        eq(FoodSearchService.cacheKey("chicken", 0, 20)),
                        anyString(),
                        eq(Duration.ofHours(24)));
    }

    @Test
    @DisplayName("serves a cache hit without calling USDA or writing to the database")
    void shouldServeCacheHitWithoutClientOrUpsert() {
        FoodSearchItem cachedItem =
                new FoodSearchItem(
                        USDA_ID,
                        "Cached",
                        null,
                        "USDA",
                        "1",
                        BigDecimal.valueOf(100),
                        "g",
                        BigDecimal.ONE,
                        BigDecimal.ONE,
                        BigDecimal.ONE,
                        BigDecimal.ONE,
                        BigDecimal.ZERO);
        String json =
                jsonMapper.writeValueAsString(
                        new FoodSearchService.CachedPage(List.of(cachedItem), 7, 1));
        when(valueOperations.get(FoodSearchService.cacheKey("chicken", 0, 20))).thenReturn(json);

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "chicken", 0, 20).getData();

        assertThat(data.getContent()).extracting(FoodSearchItem::name).containsExactly("Cached");
        assertThat(data.getTotalElements()).isEqualTo(7);
        verifyNoInteractions(usdaClient);
        verify(foodItemRepository, never())
                .upsertUsdaFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("still returns results when Redis fails")
    void shouldFailOpenWhenRedisThrows() {
        givenUsdaReturnsOneFood();
        when(valueOperations.get(anyString())).thenThrow(new RedisConnectionFailureException("x"));
        org.mockito.Mockito.doThrow(new RedisConnectionFailureException("x"))
                .when(valueOperations)
                .set(anyString(), anyString(), any(Duration.class));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "chicken", 0, 20).getData();

        assertThat(data.getContent()).hasSize(1);
    }

    @Test
    @DisplayName("puts the caller's custom foods first on page 0")
    void shouldPrependCustomFoodsOnFirstPage() {
        givenUsdaReturnsOneFood();
        when(foodItemRepository.searchCustomFoods(eq(USER_ID), eq("chicken"), any(Pageable.class)))
                .thenReturn(List.of(customFood()));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "chicken", 0, 20).getData();

        assertThat(data.getContent())
                .extracting(FoodSearchItem::source)
                .containsExactly("USER", "USDA");
        assertThat(data.getContent().getFirst().servingUnit()).isEqualTo("g");
        assertThat(data.getTotalElements()).isEqualTo(43);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(foodItemRepository).searchCustomFoods(any(), any(), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    @DisplayName("looks up no custom foods after page 0")
    void shouldSkipCustomFoodsAfterFirstPage() {
        givenUsdaReturnsOneFood();

        service.search(USER_ID, "chicken", 1, 20);

        verify(foodItemRepository, never()).searchCustomFoods(any(), any(), any());
    }

    @Test
    @DisplayName("returns custom foods alone when USDA has no hits")
    void shouldReturnCustomFoodsWhenUsdaEmpty() {
        when(usdaClient.search(anyString(), anyInt(), anyInt()))
                .thenReturn(new UsdaPage(List.of(), 0, 0));
        when(foodItemRepository.searchCustomFoods(any(), any(), any()))
                .thenReturn(List.of(customFood()));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "chicken", 0, 20).getData();

        assertThat(data.getContent()).hasSize(1);
        assertThat(data.getTotalElements()).isEqualTo(1);
        assertThat(data.getTotalPages()).isEqualTo(1);
    }

    @Test
    @DisplayName("escapes LIKE wildcards in the custom food query")
    void shouldEscapeWildcards() {
        givenUsdaReturnsOneFood();

        service.search(USER_ID, "100%_a\\b", 0, 20);

        verify(foodItemRepository).searchCustomFoods(eq(USER_ID), eq("100\\%\\_a\\\\b"), any());
    }

    @Test
    @DisplayName("rejects a query that is too short once trimmed")
    void shouldRejectShortTrimmedQuery() {
        assertThatThrownBy(() -> service.search(USER_ID, "      a ", 0, 20))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e ->
                                assertThat(e.getHttpStatus())
                                        .isEqualTo(
                                                org.springframework.http.HttpStatus.BAD_REQUEST));
        verifyNoInteractions(usdaClient, foodItemRepository);
    }

    @Test
    @DisplayName("shares a cache key across case and whitespace but not page or size")
    void shouldNormaliseCacheKey() {
        String key = FoodSearchService.cacheKey("Chicken  Breast", 0, 20);

        assertThat(key).isEqualTo(FoodSearchService.cacheKey("chicken breast", 0, 20));
        assertThat(key)
                .startsWith("food:search:")
                .isNotEqualTo(FoodSearchService.cacheKey("chicken breast", 1, 20));
        assertThat(key).isNotEqualTo(FoodSearchService.cacheKey("chicken breast", 0, 10));
    }

    @Test
    @DisplayName("does not cache a failed USDA call")
    void shouldNotCacheFailures() {
        when(usdaClient.search(anyString(), anyInt(), anyInt()))
                .thenThrow(
                        new FuelException(
                                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "down"));

        assertThatThrownBy(() -> service.search(USER_ID, "chicken", 0, 20))
                .isInstanceOf(FuelException.class);

        verify(valueOperations, never()).set(anyString(), anyString(), any(Duration.class));
        assertThat(mock(Object.class)).isNotNull();
    }

    @Test
    @DisplayName("counts a cache miss against the user's search limit")
    void shouldEnforceRateLimitOnCacheMiss() {
        givenUsdaReturnsOneFood();

        service.search(USER_ID, "chicken", 0, 20);

        verify(rateLimiterService)
                .enforce(eq("food-search:" + USER_ID), eq(30), eq(Duration.ofMinutes(1)), any());
    }

    @Test
    @DisplayName("rejects with 429 and skips USDA when the limit is exceeded")
    void shouldRejectWhenRateLimitExceeded() {
        doThrow(new RateLimitExceededException("Too many searches", Duration.ofSeconds(30)))
                .when(rateLimiterService)
                .enforce(anyString(), anyInt(), any(), anyString());

        assertThatThrownBy(() -> service.search(USER_ID, "chicken", 0, 20))
                .isInstanceOf(RateLimitExceededException.class);

        verifyNoInteractions(usdaClient);
    }

    @Test
    @DisplayName("does not count a cache hit against the limit")
    void shouldNotCountCacheHit() throws Exception {
        when(valueOperations.get(anyString()))
                .thenReturn(
                        jsonMapper.writeValueAsString(
                                new FoodSearchService.CachedPage(List.of(), 0, 0)));

        service.search(USER_ID, "chicken", 0, 20);

        verifyNoInteractions(rateLimiterService, usdaClient);
    }

    @Test
    @DisplayName("upserts in fdcId order but returns results in USDA order")
    void shouldUpsertInStableOrderAndKeepUsdaOrder() {
        UsdaFood high = usdaFood(900L, "Zeta");
        UsdaFood low = usdaFood(5L, "Alpha");
        when(usdaClient.search(anyString(), anyInt(), anyInt()))
                .thenReturn(new UsdaPage(List.of(high, low), 2, 1));
        when(foodItemRepository.upsertUsdaFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(UUID.randomUUID());

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "x1", 0, 20).getData();

        ArgumentCaptor<String> sourceIds = ArgumentCaptor.forClass(String.class);
        verify(foodItemRepository, org.mockito.Mockito.times(2))
                .upsertUsdaFood(
                        any(),
                        any(),
                        sourceIds.capture(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any());
        assertThat(sourceIds.getAllValues()).containsExactly("5", "900");
        assertThat(data.getContent())
                .extracting(FoodSearchItem::name)
                .containsExactly("Zeta", "Alpha");
    }

    private static UsdaFood usdaFood(long fdcId, String name) {
        return new UsdaFood(
                fdcId,
                String.valueOf(fdcId),
                name,
                null,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ONE);
    }
}
