package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
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
import com.lazybuff.fuel.service.OffClient.OffFood;
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
    @Mock private OffClient offClient;
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
        config.getSearch().setOffFallbackThreshold(5);
        service =
                new FoodSearchService(
                        usdaClient,
                        offClient,
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

    // ---- Open Food Facts fallback ----

    private static final UUID OFF_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private static OffFood offFood(String code, String name, String brand) {
        return new OffFood(
                code,
                code,
                name,
                brand,
                new BigDecimal("250.0"),
                new BigDecimal("5.00"),
                new BigDecimal("30.00"),
                new BigDecimal("10.00"),
                new BigDecimal("2.00"));
    }

    private void givenUsdaReturns(int count, int totalPages) {
        List<UsdaFood> foods = new java.util.ArrayList<>();
        for (int i = 1; i <= count; i++) {
            foods.add(usdaFood(i, "Usda food " + i));
        }
        when(usdaClient.search(anyString(), anyInt(), anyInt()))
                .thenReturn(new UsdaPage(foods, count, totalPages));
        org.mockito.Mockito.lenient()
                .when(
                        foodItemRepository.upsertUsdaFood(
                                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                                any()))
                .thenReturn(USDA_ID);
    }

    private void givenOffUpsertReturnsId() {
        when(foodItemRepository.upsertOffFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(OFF_ID);
    }

    private static FoodSearchItem offItem(String name, String brand) {
        return new FoodSearchItem(
                OFF_ID,
                name,
                brand,
                "OFF",
                "123",
                BigDecimal.valueOf(100),
                "g",
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ONE,
                BigDecimal.ZERO);
    }

    @Test
    @DisplayName("appends OFF products after USDA's when USDA has fewer than 5 results")
    void shouldAppendOffAfterUsdaWhenFewUsdaResults() {
        givenUsdaReturns(4, 1);
        givenOffUpsertReturnsId();
        when(offClient.search("granola"))
                .thenReturn(List.of(offFood("111", "Granola bar", "Acme")));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent()).hasSize(5);
        assertThat(data.getContent())
                .extracting(FoodSearchItem::source)
                .containsExactly("USDA", "USDA", "USDA", "USDA", "OFF");
        FoodSearchItem off = data.getContent().getLast();
        assertThat(off.id()).isEqualTo(OFF_ID);
        assertThat(off.name()).isEqualTo("Granola bar");
        assertThat(off.sourceId()).isEqualTo("111");
        assertThat(off.servingSize()).isEqualByComparingTo("100");
        assertThat(off.servingUnit()).isEqualTo("g");
    }

    @Test
    @DisplayName("does not call OFF when USDA returns 5 or more results")
    void shouldNotCallOffWhenUsdaHasEnoughResults() {
        givenUsdaReturns(5, 1);

        service.search(USER_ID, "granola", 0, 20);

        verifyNoInteractions(offClient);
    }

    @Test
    @DisplayName("does not call OFF after page 0")
    void shouldNotCallOffOnLaterPages() {
        givenUsdaReturns(2, 1);

        service.search(USER_ID, "granola", 1, 20);

        verifyNoInteractions(offClient);
    }

    @Test
    @DisplayName("does not call OFF when USDA has more pages even if this page is small")
    void shouldNotCallOffWhenUsdaHasMorePages() {
        givenUsdaReturns(3, 2);

        service.search(USER_ID, "granola", 0, 3);

        verifyNoInteractions(offClient);
    }

    @Test
    @DisplayName("returns USDA results with nothing cached for OFF when OFF fails")
    void shouldServeUsdaOnlyWhenOffFails() {
        givenUsdaReturns(2, 1);
        when(offClient.search(anyString()))
                .thenThrow(new FuelException(org.springframework.http.HttpStatus.BAD_GATEWAY, "x"));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent())
                .hasSize(2)
                .extracting(FoodSearchItem::source)
                .containsOnly("USDA");
        assertThat(data.getTotalElements()).isEqualTo(2);
        verify(valueOperations, never())
                .set(
                        eq(FoodSearchService.offCacheKey("granola")),
                        anyString(),
                        any(Duration.class));
        verify(foodItemRepository, never())
                .upsertOffFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("does not swallow non-Fuel errors from OFF")
    void shouldPropagateUnexpectedOffErrors() {
        givenUsdaReturns(2, 1);
        when(offClient.search(anyString())).thenThrow(new IllegalStateException("bug"));

        assertThatThrownBy(() -> service.search(USER_ID, "granola", 0, 20))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("serves OFF from its cache without calling OFF or saving")
    void shouldServeOffCacheHit() {
        givenUsdaReturns(2, 1);
        String json =
                jsonMapper.writeValueAsString(
                        new FoodSearchService.CachedOff(List.of(offItem("Cached bar", null))));
        when(valueOperations.get(FoodSearchService.offCacheKey("granola"))).thenReturn(json);

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent()).extracting(FoodSearchItem::name).contains("Cached bar");
        verifyNoInteractions(offClient);
        verify(foodItemRepository, never())
                .upsertOffFood(
                        any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("caches saved OFF products for the configured TTL under the OFF key")
    void shouldCacheOffOnMiss() {
        givenUsdaReturns(2, 1);
        givenOffUpsertReturnsId();
        when(offClient.search("Granola")).thenReturn(List.of(offFood("111", "Granola bar", null)));

        service.search(USER_ID, "Granola", 0, 20);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(valueOperations)
                .set(
                        eq(FoodSearchService.offCacheKey("granola")),
                        json.capture(),
                        eq(Duration.ofHours(24)));
        assertThat(json.getValue()).contains(OFF_ID.toString());
    }

    @Test
    @DisplayName(
            "shares the OFF cache key across case and whitespace and keeps it apart from USDA's")
    void shouldNormaliseOffCacheKey() {
        assertThat(FoodSearchService.offCacheKey("Granola  Bar"))
                .isEqualTo(FoodSearchService.offCacheKey(" granola bar"))
                .startsWith("food:search:off:")
                .isNotEqualTo(FoodSearchService.offCacheKey("granola"));
        assertThat(FoodSearchService.offCacheKey("granola"))
                .isNotEqualTo(FoodSearchService.cacheKey("granola", 0, 20));
    }

    @Test
    @DisplayName("keeps the USDA cache key format unchanged")
    void shouldKeepUsdaCacheKeyUnchanged() throws Exception {
        String hash =
                java.util.HexFormat.of()
                        .formatHex(
                                java.security.MessageDigest.getInstance("SHA-256")
                                        .digest(
                                                "chicken breast|0|20"
                                                        .getBytes(
                                                                java.nio.charset.StandardCharsets
                                                                        .UTF_8)));

        assertThat(FoodSearchService.cacheKey(" Chicken  Breast", 0, 20))
                .isEqualTo("food:search:" + hash);
    }

    @Test
    @DisplayName("still returns results when Redis fails during the OFF step")
    void shouldFailOpenOnOffCacheErrors() {
        givenUsdaReturns(1, 1);
        givenOffUpsertReturnsId();
        when(valueOperations.get(anyString())).thenThrow(new RedisConnectionFailureException("x"));
        doThrow(new RedisConnectionFailureException("x"))
                .when(valueOperations)
                .set(anyString(), anyString(), any(Duration.class));
        when(offClient.search(anyString()))
                .thenReturn(List.of(offFood("111", "Granola bar", null)));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent())
                .extracting(FoodSearchItem::source)
                .containsExactly("USDA", "OFF");
    }

    @Test
    @DisplayName(
            "drops an OFF product whose name and brand match a USDA item, ignoring case and spacing")
    void shouldDropOffDuplicateOfUsdaItem() {
        givenUsdaReturns(1, 1);
        givenOffUpsertReturnsId();
        when(offClient.search(anyString()))
                .thenReturn(
                        List.of(
                                offFood("111", "  USDA   FOOD 1 ", ""),
                                offFood("222", "Usda food 1", "Acme")));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent())
                .extracting(FoodSearchItem::source, FoodSearchItem::brand)
                .containsExactly(
                        org.assertj.core.api.Assertions.tuple("USDA", null),
                        org.assertj.core.api.Assertions.tuple("OFF", "Acme"));
        assertThat(data.getTotalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("counts OFF products in the totals")
    void shouldIncludeOffInTotals() {
        givenUsdaReturns(2, 1);
        givenOffUpsertReturnsId();
        when(offClient.search(anyString()))
                .thenReturn(List.of(offFood("111", "A bar", null), offFood("222", "B bar", null)));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getTotalElements()).isEqualTo(4);
        assertThat(data.getTotalPages()).isEqualTo(1);
    }

    @Test
    @DisplayName("returns OFF products after custom foods when USDA has no hits")
    void shouldReturnCustomThenOffWhenUsdaEmpty() {
        givenUsdaReturns(0, 0);
        givenOffUpsertReturnsId();
        when(foodItemRepository.searchCustomFoods(any(), any(), any()))
                .thenReturn(List.of(customFood()));
        when(offClient.search(anyString())).thenReturn(List.of(offFood("111", "A bar", null)));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent())
                .extracting(FoodSearchItem::source)
                .containsExactly("USER", "OFF");
        assertThat(data.getTotalElements()).isEqualTo(2);
        assertThat(data.getTotalPages()).isEqualTo(1);
    }

    @Test
    @DisplayName("returns no content and zero pages when USDA and OFF both find nothing")
    void shouldReturnEmptyWhenOffReturnsNothing() {
        givenUsdaReturns(0, 0);
        when(offClient.search(anyString())).thenReturn(List.of());

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "zzzz", 0, 20).getData();

        assertThat(data.getContent()).isEmpty();
        assertThat(data.getTotalElements()).isZero();
        assertThat(data.getTotalPages()).isZero();
    }

    @Test
    @DisplayName("upserts OFF products in code order but returns them in OFF order")
    void shouldUpsertOffInStableOrder() {
        givenUsdaReturns(0, 0);
        givenOffUpsertReturnsId();
        when(offClient.search(anyString()))
                .thenReturn(List.of(offFood("900", "Zeta", null), offFood("5", "Alpha", null)));

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        ArgumentCaptor<String> sourceIds = ArgumentCaptor.forClass(String.class);
        verify(foodItemRepository, org.mockito.Mockito.times(2))
                .upsertOffFood(
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

    @Test
    @DisplayName("takes a rate-limit token for each uncached OFF call")
    void shouldRateLimitOffCalls() {
        givenUsdaReturns(1, 1);
        when(offClient.search(anyString())).thenReturn(List.of());

        service.search(USER_ID, "granola", 0, 20);

        verify(rateLimiterService, org.mockito.Mockito.times(2))
                .enforce(eq("food-search:" + USER_ID), eq(30), eq(Duration.ofMinutes(1)), any());
    }

    @Test
    @DisplayName("returns USDA results without calling OFF when the OFF token is refused")
    void shouldReturnUsdaWhenOffIsRateLimited() {
        givenUsdaReturns(1, 1);
        doNothing()
                .doThrow(
                        new RateLimitExceededException("Too many searches", Duration.ofSeconds(30)))
                .when(rateLimiterService)
                .enforce(any(), anyInt(), any(), any());

        PageResponse<FoodSearchItem> data = service.search(USER_ID, "granola", 0, 20).getData();

        assertThat(data.getContent()).extracting(FoodSearchItem::source).containsExactly("USDA");
        verifyNoInteractions(offClient);
    }
}
