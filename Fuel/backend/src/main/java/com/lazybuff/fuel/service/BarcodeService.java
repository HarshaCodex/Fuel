package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.FoodItemToFoodItemDetailMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.service.OffClient.OffFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaFood;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Finds a food by barcode: Redis, then the local table, then Open Food Facts, then USDA branded
 * foods. A found product is saved with its canonical barcode so the next lookup is local.
 *
 * <p>Only an outbound lookup costs the caller a rate-limit token; cache and table hits are free.
 * Not-found results and upstream failures are never cached. A 404 is returned only when every
 * source answered cleanly with no match; otherwise the upstream failure is rethrown. Redis failures
 * are logged and skipped.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class BarcodeService {

    private static final String CACHE_KEY_PREFIX = "food:barcode:";
    private static final String RATE_LIMIT_KEY_PREFIX = "food-barcode:";
    private static final Pattern BARCODE = Pattern.compile("\\d{8,14}");
    private static final int CANONICAL_LENGTH = 13;
    private static final BigDecimal SERVING_SIZE = BigDecimal.valueOf(100);
    private static final String SERVING_UNIT = "g";

    private final OffClient offClient;

    private final UsdaClient usdaClient;

    private final FoodItemRepository foodItemRepository;

    private final FoodItemToFoodItemDetailMapper detailMapper;

    private final StringRedisTemplate redisTemplate;

    private final TransactionTemplate transactionTemplate;

    private final FoodSearchConfig config;

    private final JsonMapper jsonMapper;

    private final RateLimiterService rateLimiterService;

    public ApiResponse<FoodItemDetail> lookup(UUID userId, String code) {

        if (code == null || !BARCODE.matcher(code).matches()) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "Barcode must be 8 to 14 digits");
        }
        String barcode = canonical(code);
        String key = CACHE_KEY_PREFIX + barcode;

        FoodItemDetail cached = readCache(key);
        if (cached != null) {
            return success(cached);
        }

        Optional<FoodItem> local = foodItemRepository.findSharedByBarcode(barcode);
        if (local.isPresent()) {
            return success(cacheAndReturn(key, loadDetail(local.get().getId())));
        }

        // Only an outbound lookup spends OFF/USDA quota, so only it counts against the limit.
        enforceRateLimit(userId);

        FuelException failure = null;
        Optional<OffFood> off = Optional.empty();
        try {
            off = offClient.findByBarcode(barcode);
        } catch (FuelException exception) {
            log.warn(
                    "OFF barcode lookup failed, trying USDA: {}",
                    exception.getHttpStatus().value());
            failure = exception;
        }
        if (off.isPresent()) {
            return success(cacheAndReturn(key, saveOff(off.get(), barcode)));
        }

        try {
            Optional<UsdaFood> usda = usdaClient.findByGtin(barcode);
            if (usda.isPresent()) {
                return success(cacheAndReturn(key, saveUsda(usda.get(), barcode)));
            }
        } catch (FuelException exception) {
            log.warn("USDA barcode lookup failed: {}", exception.getHttpStatus().value());
            failure = exception;
        }
        if (failure != null) {
            throw failure;
        }
        throw new FuelException(HttpStatus.NOT_FOUND, "Food item not found");
    }

    /** Strips leading zeros and left-pads to 13 digits, so UPC-A and EAN-13 are one product. */
    static String canonical(String code) {
        String stripped = code.replaceFirst("^0+", "");
        return "0".repeat(Math.max(0, CANONICAL_LENGTH - stripped.length())) + stripped;
    }

    private FoodItemDetail saveOff(OffFood food, String barcode) {
        return transactionTemplate.execute(
                status -> {
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
                    foodItemRepository.setBarcode(id, barcode);
                    return loadDetail(id);
                });
    }

    private FoodItemDetail saveUsda(UsdaFood food, String barcode) {
        return transactionTemplate.execute(
                status -> {
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
                    foodItemRepository.setBarcode(id, barcode);
                    return loadDetail(id);
                });
    }

    private FoodItemDetail loadDetail(UUID id) {
        FoodItem item =
                foodItemRepository
                        .findWithServingSizesById(id)
                        .orElseThrow(
                                () ->
                                        new FuelException(
                                                HttpStatus.NOT_FOUND, "Food item not found"));
        return detailMapper.foodItemToFoodItemDetail(item);
    }

    private FoodItemDetail cacheAndReturn(String key, FoodItemDetail detail) {
        writeCache(key, detail);
        return detail;
    }

    private static ApiResponse<FoodItemDetail> success(FoodItemDetail detail) {
        return ApiResponse.<FoodItemDetail>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(detail)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private void enforceRateLimit(UUID userId) {
        rateLimiterService.enforce(
                RATE_LIMIT_KEY_PREFIX + userId,
                config.getBarcode().getRateLimit(),
                config.getBarcode().getRateLimitWindow(),
                "Too many barcode lookups. Please try again later.");
    }

    private FoodItemDetail readCache(String key) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            return json == null ? null : jsonMapper.readValue(json, FoodItemDetail.class);
        } catch (RuntimeException exception) {
            log.warn("Barcode cache read failed: {}", exception.getClass().getSimpleName());
            return null;
        }
    }

    private void writeCache(String key, FoodItemDetail detail) {
        try {
            redisTemplate
                    .opsForValue()
                    .set(
                            key,
                            jsonMapper.writeValueAsString(detail),
                            config.getBarcode().getCacheTtl());
        } catch (RuntimeException exception) {
            log.warn("Barcode cache write failed: {}", exception.getClass().getSimpleName());
        }
    }
}
