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
import org.springframework.http.HttpHeaders;
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
 * Searches Open Food Facts, a public API that needs no key. Its data is untrusted third-party text,
 * so every field is length-capped and range-checked. Failures become {@link FuelException}s with a
 * generic message: the query, URL and OFF's response body are never logged or exposed.
 */
@Component
@Slf4j
public class OffClient {

    private static final int MAX_NAME = 300;
    private static final int MAX_BRAND = 200;
    private static final int MAX_CODE = 32;
    private static final int MAX_SCALE = 100;
    private static final BigDecimal TOO_LARGE = BigDecimal.valueOf(Long.MAX_VALUE);
    private static final BigDecimal MAX_CALORIES = BigDecimal.valueOf(1000);
    private static final BigDecimal MAX_MACRO = BigDecimal.valueOf(100);

    /** One Open Food Facts product, nutrients per 100 g. */
    public record OffFood(
            String code,
            String sourceId,
            String name,
            String brand,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {}

    private final FoodSearchConfig config;

    private final RestClient restClient;

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Autowired
    public OffClient(FoodSearchConfig config) {
        this(config, RestClient.builder().requestFactory(requestFactory(config)));
    }

    /** Visible for tests, which bind a mock server to the builder. */
    OffClient(FoodSearchConfig config, RestClient.Builder restClientBuilder) {
        this.config = config;
        this.restClient = restClientBuilder.baseUrl(config.getOff().getBaseUrl()).build();
        if (!config.getOff().hasUserAgent()) {
            log.warn("Open Food Facts user agent not configured; OFF lookups are skipped");
        }
    }

    private static JdkClientHttpRequestFactory requestFactory(FoodSearchConfig config) {
        Duration timeout = config.getOff().getHttpTimeout();
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(timeout);
        return factory;
    }

    /**
     * Searches products by text; products without usable nutrition are skipped.
     *
     * @throws FuelException 503 when OFF is unreachable, rate limiting or failing (or the user
     *     agent is unset); 502 when it rejects the request or answers with something unusable
     */
    public List<OffFood> search(String query) {

        if (!config.getOff().hasUserAgent()) {
            throw unavailable(HttpStatus.SERVICE_UNAVAILABLE);
        }

        String body;
        try {
            body =
                    restClient
                            .get()
                            .uri(
                                    "/cgi/search.pl?search_terms={q}&search_simple=1&action=process"
                                            + "&json=1&page_size={size}&page=1"
                                            + "&fields=code,product_name,brands,nutriments",
                                    query,
                                    config.getOff().getMaxResults())
                            .header(HttpHeaders.USER_AGENT, config.getOff().getUserAgent())
                            .retrieve()
                            .body(String.class);
        } catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            boolean retryable = status == 429 || status >= 500;
            if (retryable) {
                log.warn("OFF search failed with status {}", status);
            } else {
                log.error("OFF search failed with status {}", status);
            }
            throw unavailable(retryable ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY);
        } catch (ResourceAccessException exception) {
            log.warn("OFF search unreachable: {}", exception.getClass().getSimpleName());
            throw unavailable(HttpStatus.SERVICE_UNAVAILABLE);
        } catch (RestClientException exception) {
            log.error("OFF search failed: {}", exception.getClass().getSimpleName());
            throw unavailable(HttpStatus.BAD_GATEWAY);
        }
        return parse(body);
    }

    private List<OffFood> parse(String body) {
        try {
            JsonNode root = body == null || body.isBlank() ? null : jsonMapper.readTree(body);
            if (root == null || !root.path("products").isArray()) {
                log.error("OFF search returned an unusable body");
                throw unavailable(HttpStatus.BAD_GATEWAY);
            }
            Map<String, OffFood> foods = new LinkedHashMap<>();
            for (JsonNode node : root.path("products")) {
                toFood(node).ifPresent(food -> foods.putIfAbsent(food.code(), food));
            }
            return new ArrayList<>(foods.values());
        } catch (JacksonException exception) {
            log.error("OFF search returned unparsable JSON");
            throw unavailable(HttpStatus.BAD_GATEWAY);
        }
    }

    private Optional<OffFood> toFood(JsonNode node) {
        String code = node.path("code").asString("").trim();
        String name = node.path("product_name").asString("").trim();
        if (!code.matches("\\d{1," + MAX_CODE + "}") || name.isEmpty()) {
            return Optional.empty();
        }
        JsonNode nutriments = node.path("nutriments");
        BigDecimal calories = number(nutriments.path("energy-kcal_100g"));
        if (calories == null || calories.signum() < 0 || calories.compareTo(MAX_CALORIES) > 0) {
            return Optional.empty();
        }
        // Range-check before scaling: setScale on a huge exponent (1e999999999) would stall or OOM.
        BigDecimal protein = rawMacro(nutriments.path("proteins_100g"));
        BigDecimal carbs = rawMacro(nutriments.path("carbohydrates_100g"));
        BigDecimal fat = rawMacro(nutriments.path("fat_100g"));
        BigDecimal fiber = rawMacro(nutriments.path("fiber_100g"));
        if (isOverLimit(protein) || isOverLimit(carbs) || isOverLimit(fat) || isOverLimit(fiber)) {
            return Optional.empty();
        }
        return Optional.of(
                new OffFood(
                        code,
                        code,
                        UsdaClient.truncate(name, MAX_NAME),
                        brand(node.path("brands").asString("")),
                        calories.setScale(1, RoundingMode.HALF_UP),
                        scale(protein),
                        scale(carbs),
                        scale(fat),
                        scale(fiber)));
    }

    /** {@code brands} is comma separated; the first non-blank entry is the brand. */
    private static String brand(String brands) {
        for (String candidate : brands.split(",")) {
            String trimmed = candidate.trim();
            if (!trimmed.isEmpty()) {
                return UsdaClient.truncate(trimmed, MAX_BRAND);
            }
        }
        return null;
    }

    private static boolean isOverLimit(BigDecimal macro) {
        return macro.compareTo(MAX_MACRO) > 0;
    }

    /** OFF sends numbers either as JSON numbers or as numeric strings; anything else is missing. */
    private static BigDecimal number(JsonNode value) {
        BigDecimal number = null;
        if (value.isNumber()) {
            number = value.decimalValue();
        } else if (value.isString()) {
            try {
                number = new BigDecimal(value.asString().trim());
            } catch (NumberFormatException exception) {
                return null;
            }
        }
        if (number == null) {
            return null;
        }
        // Absurd exponents would make later comparisons and scaling expensive: a huge value is
        // replaced by a stand-in that fails every range check, a vanishingly small one is missing.
        if (number.scale() < -MAX_SCALE) {
            return number.signum() < 0 ? null : TOO_LARGE;
        }
        return number.scale() > MAX_SCALE ? null : number;
    }

    /** Missing or negative nutrients count as zero. Not scaled yet: see {@link #scale}. */
    private static BigDecimal rawMacro(JsonNode value) {
        BigDecimal number = number(value);
        return number == null || number.signum() < 0 ? BigDecimal.ZERO : number;
    }

    /** Only for values already known to be within range. */
    private static BigDecimal scale(BigDecimal macro) {
        return macro.setScale(2, RoundingMode.HALF_UP);
    }

    private static FuelException unavailable(HttpStatus status) {
        return new FuelException(status, UsdaClient.UNAVAILABLE);
    }
}
