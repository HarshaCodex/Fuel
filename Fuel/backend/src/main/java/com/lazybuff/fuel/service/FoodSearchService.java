package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodSearchItem;
import com.lazybuff.fuel.dto.PageResponse;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.FoodSearchMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.service.OffClient.OffFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaPage;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Searches USDA foods, saving each result so it has an internal id, and puts the caller's matching
 * custom foods first on page 0. When USDA is exhausted on page 0 with few results, Open Food Facts
 * products are appended; an OFF failure never fails the search.
 *
 * <p>The USDA and OFF parts are cached in Redis (shared by all users, under separate keys, so an
 * OFF outage cannot poison USDA entries); custom foods are per user and never cached. Redis
 * failures are logged and skipped: search keeps working, just uncached.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class FoodSearchService {

    private static final String CACHE_KEY_PREFIX = "food:search:";
    private static final String OFF_CACHE_KEY_PREFIX = "food:search:off:";
    private static final String RATE_LIMIT_KEY_PREFIX = "food-search:";
    private static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_QUERY_LENGTH = 100;
    private static final BigDecimal SERVING_SIZE = BigDecimal.valueOf(100);
    private static final String SERVING_UNIT = "g";

    /** What is cached for one USDA result page. */
    record CachedPage(List<FoodSearchItem> items, long totalHits, int totalPages) {}

    /** What is cached for one OFF search, already saved so every item has an internal id. */
    record CachedOff(List<FoodSearchItem> items) {}

    private final UsdaClient usdaClient;

    private final OffClient offClient;

    private final FoodItemRepository foodItemRepository;

    private final FoodSearchMapper foodSearchMapper;

    private final StringRedisTemplate redisTemplate;

    private final TransactionTemplate transactionTemplate;

    private final FoodSearchConfig config;

    private final JsonMapper jsonMapper;

    private final RateLimiterService rateLimiterService;

    public ApiResponse<PageResponse<FoodSearchItem>> search(
            UUID userId, String q, int page, int size) {

        String query = q == null ? "" : q.trim();
        int length = query.codePointCount(0, query.length());
        if (length < MIN_QUERY_LENGTH || length > MAX_QUERY_LENGTH) {
            throw new FuelException(
                    HttpStatus.BAD_REQUEST,
                    "Search query must be "
                            + MIN_QUERY_LENGTH
                            + " to "
                            + MAX_QUERY_LENGTH
                            + " characters");
        }

        CachedPage usda = usdaPage(userId, query, page, size);

        List<FoodSearchItem> content = new ArrayList<>();
        if (page == 0) {
            content.addAll(customFoods(userId, query));
        }
        int customCount = content.size();
        content.addAll(usda.items());
        List<FoodSearchItem> off = offItems(userId, query, page, usda);
        content.addAll(off);

        int totalPages = Math.max(usda.totalPages(), customCount + off.size() > 0 ? 1 : 0);
        PageResponse<FoodSearchItem> data =
                PageResponse.<FoodSearchItem>builder()
                        .content(content)
                        .page(page)
                        .size(size)
                        .totalElements(usda.totalHits() + customCount + off.size())
                        .totalPages(totalPages)
                        .build();
        return ApiResponse.<PageResponse<FoodSearchItem>>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private CachedPage usdaPage(UUID userId, String query, int page, int size) {

        String key = cacheKey(query, page, size);
        CachedPage cached = readCache(key, CachedPage.class);
        if (cached != null) {
            return cached;
        }

        // Only a miss costs a USDA call, so only a miss counts against the user's limit.
        enforceRateLimit(userId);

        UsdaPage fetched = usdaClient.search(query, page, size);
        List<FoodSearchItem> items = transactionTemplate.execute(status -> upsertAll(fetched));
        CachedPage result = new CachedPage(items, fetched.totalHits(), fetched.totalPages());
        writeCache(key, result);
        return result;
    }

    /**
     * OFF products to append after USDA's. Only asked when USDA is exhausted on page 0 with few
     * results, so paging stays consistent. Failures are not cached and fall back to USDA alone.
     */
    private List<FoodSearchItem> offItems(UUID userId, String query, int page, CachedPage usda) {
        if (page != 0
                || usda.items().size() >= config.getSearch().getOffFallbackThreshold()
                || usda.totalPages() > 1) {
            return List.of();
        }
        String key = offCacheKey(query);
        CachedOff cached = readCache(key, CachedOff.class);
        if (cached == null) {
            List<OffFood> fetched;
            try {
                // Failures are not cached, so every outbound OFF call spends a token; a limited
                // user still gets the USDA results.
                enforceRateLimit(userId);
                fetched = offClient.search(query);
            } catch (FuelException exception) {
                log.warn(
                        "OFF search failed, serving USDA only: {} {}",
                        exception.getClass().getSimpleName(),
                        exception.getHttpStatus().value());
                return List.of();
            }
            List<FoodSearchItem> saved = transactionTemplate.execute(status -> upsertOff(fetched));
            cached = new CachedOff(saved);
            writeCache(key, cached);
        }
        Set<String> usdaNames =
                usda.items().stream()
                        .map(item -> nameAndBrand(item.name(), item.brand()))
                        .collect(Collectors.toSet());
        return cached.items().stream()
                .filter(item -> !usdaNames.contains(nameAndBrand(item.name(), item.brand())))
                .toList();
    }

    /** Same stable-order upsert as {@link #upsertAll}; the result keeps OFF's order. */
    private List<FoodSearchItem> upsertOff(List<OffFood> fetched) {
        Map<String, FoodSearchItem> saved = new HashMap<>();
        fetched.stream()
                .sorted(Comparator.comparing(OffFood::code))
                .forEach(food -> saved.put(food.code(), upsertOff(food)));
        return fetched.stream().map(food -> saved.get(food.code())).toList();
    }

    private FoodSearchItem upsertOff(OffFood food) {
        UUID id =
                foodItemRepository.upsertOffFood(
                        food.name(),
                        food.brand(),
                        food.sourceId(),
                        SERVING_SIZE,
                        SERVING_UNIT,
                        food.calories(),
                        food.protein(),
                        food.carbs(),
                        food.fat(),
                        food.fiber());
        return foodSearchMapper.fromOff(id, food);
    }

    private static String nameAndBrand(String name, String brand) {
        return normalise(name) + "|" + normalise(brand == null ? "" : brand);
    }

    private void enforceRateLimit(UUID userId) {
        rateLimiterService.enforce(
                RATE_LIMIT_KEY_PREFIX + userId,
                config.getSearch().getRateLimit(),
                config.getSearch().getRateLimitWindow(),
                "Too many searches. Please try again later.");
    }

    /**
     * Upserts in a stable order so overlapping searches lock shared rows in the same order and
     * cannot deadlock; the result keeps USDA's order.
     */
    private List<FoodSearchItem> upsertAll(UsdaPage fetched) {
        Map<Long, FoodSearchItem> saved = new HashMap<>();
        fetched.foods().stream()
                .sorted(Comparator.comparingLong(UsdaClient.UsdaFood::fdcId))
                .forEach(food -> saved.put(food.fdcId(), upsert(food)));
        return fetched.foods().stream().map(food -> saved.get(food.fdcId())).toList();
    }

    private FoodSearchItem upsert(UsdaClient.UsdaFood food) {
        UUID id =
                foodItemRepository.upsertUsdaFood(
                        food.name(),
                        food.brand(),
                        food.sourceId(),
                        SERVING_SIZE,
                        SERVING_UNIT,
                        food.calories(),
                        food.protein(),
                        food.carbs(),
                        food.fat(),
                        food.fiber());
        return foodSearchMapper.fromUsda(id, food);
    }

    private List<FoodSearchItem> customFoods(UUID userId, String query) {
        String escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return foodItemRepository
                .searchCustomFoods(
                        userId, escaped, Pageable.ofSize(config.getSearch().getMaxCustomResults()))
                .stream()
                .map(foodSearchMapper::fromCustom)
                .toList();
    }

    private <T> T readCache(String key, Class<T> type) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            return json == null ? null : jsonMapper.readValue(json, type);
        } catch (RuntimeException exception) {
            log.warn("Food search cache read failed: {}", exception.getClass().getSimpleName());
            return null;
        }
    }

    private void writeCache(String key, Object page) {
        try {
            redisTemplate
                    .opsForValue()
                    .set(
                            key,
                            jsonMapper.writeValueAsString(page),
                            config.getSearch().getCacheTtl());
        } catch (RuntimeException exception) {
            log.warn("Food search cache write failed: {}", exception.getClass().getSimpleName());
        }
    }

    /** Equivalent queries ("Chicken Breast", "chicken breast") share one entry. */
    static String cacheKey(String query, int page, int size) {
        return CACHE_KEY_PREFIX + sha256(normalise(query) + "|" + page + "|" + size);
    }

    static String offCacheKey(String query) {
        return OFF_CACHE_KEY_PREFIX + sha256(normalise(query));
    }

    private static String normalise(String text) {
        return text.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static String sha256(String text) {
        try {
            byte[] hash =
                    MessageDigest.getInstance("SHA-256")
                            .digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
