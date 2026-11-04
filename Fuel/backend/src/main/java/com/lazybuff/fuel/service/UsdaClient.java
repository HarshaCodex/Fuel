package com.lazybuff.fuel.service;

import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.exception.FuelException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Searches USDA FoodData Central. The API key travels in the {@code X-Api-Key} header, never the
 * URL, so neither exceptions nor logs can leak it. Failures become {@link FuelException}s with a
 * generic message: the URL, key and USDA's response body are never exposed.
 */
@Component
@Slf4j
public class UsdaClient {

    static final String UNAVAILABLE = "Food search is temporarily unavailable";

    private static final String API_KEY_HEADER = "X-Api-Key";
    private static final int MAX_NAME = 300;
    private static final int MAX_BRAND = 200;
    private static final int GTIN_PAGE_SIZE = 25;
    private static final long CALORIES = 1008;
    private static final long[] CALORIES_FALLBACKS = {2047, 2048};
    private static final long PROTEIN = 1003;
    private static final long FAT = 1004;
    private static final long CARBS = 1005;
    private static final long FIBER = 1079;

    /** One USDA food, nutrients per 100 g. */
    public record UsdaFood(
            long fdcId,
            String sourceId,
            String name,
            String brand,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {}

    /** One page of USDA results. */
    public record UsdaPage(List<UsdaFood> foods, long totalHits, int totalPages) {}

    private final FoodSearchConfig config;

    private final RestClient restClient;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Autowired
    public UsdaClient(FoodSearchConfig config) {
        this(config, RestClient.builder().requestFactory(requestFactory(config)));
    }

    /** Visible for tests, which bind a mock server to the builder. */
    UsdaClient(FoodSearchConfig config, RestClient.Builder restClientBuilder) {
        this.config = config;
        this.restClient = restClientBuilder.baseUrl(config.getUsda().getBaseUrl()).build();
        if (!config.getUsda().hasApiKey()) {
            log.warn("USDA API key not configured; food search will return 503");
        }
    }

    private static JdkClientHttpRequestFactory requestFactory(FoodSearchConfig config) {
        Duration timeout = config.getUsda().getHttpTimeout();
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(timeout);
        return factory;
    }

    /**
     * Searches foods by text.
     *
     * @param page zero-based; USDA's own paging is one-based
     * @throws FuelException 503 when USDA is unreachable, rate limiting or failing (or the key is
     *     unset); 502 when it rejects the request or answers with something unusable
     */
    public UsdaPage search(String query, int page, int size) {

        if (!config.getUsda().hasApiKey()) {
            throw unavailable(HttpStatus.SERVICE_UNAVAILABLE);
        }

        return parse(
                get(
                        "/foods/search?query={q}&pageSize={size}&pageNumber={page}",
                        query,
                        size,
                        page + 1));
    }

    /**
     * Finds a branded food by GTIN/UPC. USDA has no GTIN endpoint, so this searches by the code and
     * keeps only a food whose {@code gtinUpc} matches once leading zeros are ignored on both sides.
     *
     * @param canonical digits only
     * @throws FuelException as {@link #search}
     */
    public Optional<UsdaFood> findByGtin(String canonical) {
        if (!config.getUsda().hasApiKey()) {
            throw unavailable(HttpStatus.SERVICE_UNAVAILABLE);
        }
        String body =
                get(
                        "/foods/search?query={q}&dataType=Branded&pageSize={size}",
                        canonical,
                        GTIN_PAGE_SIZE);
        String wanted = stripZeros(canonical);
        if (wanted.isEmpty()) {
            return Optional.empty();
        }
        try {
            JsonNode root = body == null || body.isBlank() ? null : jsonMapper.readTree(body);
            if (root == null || !root.path("foods").isArray()) {
                log.error("USDA search returned an unusable body");
                throw unavailable(HttpStatus.BAD_GATEWAY);
            }
            for (JsonNode node : root.path("foods")) {
                if (wanted.equals(stripZeros(node.path("gtinUpc").asString("").trim()))) {
                    Optional<UsdaFood> food = toFood(node);
                    if (food.isPresent()) {
                        return food;
                    }
                }
            }
            return Optional.empty();
        } catch (JacksonException exception) {
            log.error("USDA search returned unparsable JSON");
            throw unavailable(HttpStatus.BAD_GATEWAY);
        }
    }

    private static String stripZeros(String digits) {
        return digits.replaceFirst("^0+", "");
    }

    private String get(String uri, Object... variables) {
        try {
            return restClient
                    .get()
                    .uri(uri, variables)
                    .header(API_KEY_HEADER, config.getUsda().getApiKey())
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            boolean retryable = status == 429 || status >= 500;
            if (retryable) {
                log.warn("USDA request failed with status {}", status);
            } else {
                log.error("USDA request failed with status {}", status);
            }
            throw unavailable(retryable ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY);
        } catch (ResourceAccessException exception) {
            log.warn("USDA request unreachable: {}", exception.getClass().getSimpleName());
            throw unavailable(HttpStatus.SERVICE_UNAVAILABLE);
        } catch (RestClientException exception) {
            log.error("USDA request failed: {}", exception.getClass().getSimpleName());
            throw unavailable(HttpStatus.BAD_GATEWAY);
        }
    }

    private UsdaPage parse(String body) {
        try {
            JsonNode root = body == null || body.isBlank() ? null : jsonMapper.readTree(body);
            if (root == null || !root.path("foods").isArray()) {
                log.error("USDA search returned an unusable body");
                throw unavailable(HttpStatus.BAD_GATEWAY);
            }
            Map<Long, UsdaFood> foods = new LinkedHashMap<>();
            for (JsonNode node : root.path("foods")) {
                toFood(node).ifPresent(food -> foods.putIfAbsent(food.fdcId(), food));
            }
            return new UsdaPage(
                    new ArrayList<>(foods.values()),
                    root.path("totalHits").asLong(0),
                    root.path("totalPages").asInt(0));
        } catch (JacksonException exception) {
            log.error("USDA search returned unparsable JSON");
            throw unavailable(HttpStatus.BAD_GATEWAY);
        }
    }

    private Optional<UsdaFood> toFood(JsonNode node) {
        JsonNode id = node.path("fdcId");
        String name = node.path("description").asString("").trim();
        if (!id.isIntegralNumber() || name.isEmpty()) {
            return Optional.empty();
        }
        Map<Long, BigDecimal> nutrients = nutrients(node.path("foodNutrients"));
        BigDecimal calories = nutrients.get(CALORIES);
        for (int i = 0; calories == null && i < CALORIES_FALLBACKS.length; i++) {
            calories = nutrients.get(CALORIES_FALLBACKS[i]);
        }
        if (calories == null || calories.signum() < 0) {
            return Optional.empty();
        }
        String brand = node.path("brandName").asString("").trim();
        if (brand.isEmpty()) {
            brand = node.path("brandOwner").asString("").trim();
        }
        long fdcId = id.longValue();
        return Optional.of(
                new UsdaFood(
                        fdcId,
                        String.valueOf(fdcId),
                        truncate(name, MAX_NAME),
                        brand.isEmpty() ? null : truncate(brand, MAX_BRAND),
                        calories.setScale(1, RoundingMode.HALF_UP),
                        macro(nutrients, PROTEIN),
                        macro(nutrients, CARBS),
                        macro(nutrients, FAT),
                        macro(nutrients, FIBER)));
    }

    private static Map<Long, BigDecimal> nutrients(JsonNode array) {
        Map<Long, BigDecimal> result = new LinkedHashMap<>();
        for (JsonNode nutrient : array) {
            JsonNode id = nutrient.path("nutrientId");
            JsonNode value = nutrient.path("value");
            if (id.isIntegralNumber() && value.isNumber()) {
                result.putIfAbsent(id.longValue(), value.decimalValue());
            }
        }
        return result;
    }

    /** Missing or negative nutrients count as zero. */
    private static BigDecimal macro(Map<Long, BigDecimal> nutrients, long id) {
        BigDecimal value = nutrients.get(id);
        if (value == null || value.signum() < 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    static String truncate(String text, int maxCodePoints) {
        if (text.codePointCount(0, text.length()) <= maxCodePoints) {
            return text;
        }
        return text.substring(0, text.offsetByCodePoints(0, maxCodePoints));
    }

    private static FuelException unavailable(HttpStatus status) {
        return new FuelException(status, UNAVAILABLE);
    }
}
