package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.lazybuff.fuel.config.FoodSearchConfig;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.service.UsdaClient.UsdaFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaPage;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@DisplayName("UsdaClient")
class UsdaClientTest {

    private static final String BASE_URL = "https://usda.test/fdc/v1";
    private static final String API_KEY = "s3cret-usda-key";

    private FoodSearchConfig config;

    private MockRestServiceServer usda;

    private UsdaClient client;

    @BeforeEach
    void setUp() {
        config = config(BASE_URL, API_KEY, Duration.ofSeconds(5));
        RestClient.Builder builder = RestClient.builder();
        usda = MockRestServiceServer.bindTo(builder).build();
        client = new UsdaClient(config, builder);
    }

    private static FoodSearchConfig config(String baseUrl, String apiKey, Duration timeout) {
        FoodSearchConfig config = new FoodSearchConfig();
        config.getUsda().setBaseUrl(baseUrl);
        config.getUsda().setApiKey(apiKey);
        config.getUsda().setHttpTimeout(timeout);
        return config;
    }

    private void respondWith(String json) {
        usda.expect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    private static String food(String fdcId, String description, String nutrients) {
        return "{\"fdcId\":"
                + fdcId
                + ",\"description\":\""
                + description
                + "\","
                + "\"foodNutrients\":["
                + nutrients
                + "]}";
    }

    private static String nutrient(int id, String value) {
        return "{\"nutrientId\":" + id + ",\"value\":" + value + "}";
    }

    private static String page(String... foods) {
        return "{\"totalHits\":42,\"totalPages\":3,\"foods\":[" + String.join(",", foods) + "]}";
    }

    @Test
    @DisplayName("maps a USDA food to per-100 g nutrients, scaled and with the brand")
    void shouldMapFood() {
        respondWith(
                page(
                        "{\"fdcId\":171077,\"description\":\"Chicken breast\","
                                + "\"brandOwner\":\"Acme Foods\",\"unknownField\":true,"
                                + "\"foodNutrients\":["
                                + nutrient(1008, "165.04")
                                + ","
                                + nutrient(1003, "31.016")
                                + ","
                                + nutrient(1004, "3.6")
                                + ","
                                + nutrient(1005, "0")
                                + ","
                                + nutrient(1079, "-1")
                                + "]}"));

        UsdaPage result = client.search("chicken", 0, 20);

        assertThat(result.totalHits()).isEqualTo(42);
        assertThat(result.totalPages()).isEqualTo(3);
        assertThat(result.foods()).hasSize(1);
        UsdaFood mapped = result.foods().getFirst();
        assertThat(mapped.sourceId()).isEqualTo("171077");
        assertThat(mapped.name()).isEqualTo("Chicken breast");
        assertThat(mapped.brand()).isEqualTo("Acme Foods");
        assertThat(mapped.calories()).isEqualByComparingTo("165.0");
        assertThat(mapped.calories().scale()).isEqualTo(1);
        assertThat(mapped.protein()).isEqualTo(new BigDecimal("31.02"));
        assertThat(mapped.fat()).isEqualTo(new BigDecimal("3.60"));
        assertThat(mapped.carbs()).isEqualTo(new BigDecimal("0.00"));
        assertThat(mapped.fiber()).isEqualTo(new BigDecimal("0.00"));
    }

    @Test
    @DisplayName("sends the key in the X-Api-Key header, not the URL, and a 1-based page")
    void shouldSendKeyAsHeaderAndOneBasedPage() {
        usda.expect(requestTo(containsString("/fdc/v1/foods/search")))
                .andExpect(requestTo(not(containsString(API_KEY))))
                .andExpect(header("X-Api-Key", API_KEY))
                .andExpect(queryParam("query", "chicken%20%26%20rice"))
                .andExpect(queryParam("pageSize", "20"))
                .andExpect(queryParam("pageNumber", "3"))
                .andRespond(withSuccess(page(), MediaType.APPLICATION_JSON));

        client.search("chicken & rice", 2, 20);

        usda.verify();
    }

    @Test
    @DisplayName("percent-encodes &, + and spaces so q cannot add query parameters")
    void shouldEncodeReservedCharactersInQuery() {
        usda.expect(requestTo(containsString("query=mac%20%26%20cheese%2B1&pageSize=20")))
                .andRespond(withSuccess(page(), MediaType.APPLICATION_JSON));

        client.search("mac & cheese+1", 0, 20);

        usda.verify();
    }

    @Test
    @DisplayName("uses an energy fallback nutrient when kcal is missing")
    void shouldFallBackToAtwaterEnergy() {
        respondWith(page(food("1", "Oats", nutrient(2047, "380"))));

        assertThat(client.search("oats", 0, 20).foods().getFirst().calories())
                .isEqualByComparingTo("380");
    }

    @Test
    @DisplayName("skips foods without id, name or calories and dedupes repeated ids")
    void shouldSkipUnusableAndDuplicateFoods() {
        respondWith(
                page(
                        "{\"description\":\"No id\",\"foodNutrients\":["
                                + nutrient(1008, "1")
                                + "]}",
                        food("2", "   ", nutrient(1008, "1")),
                        food("3", "No calories", nutrient(1003, "5")),
                        food("4", "Kept", nutrient(1008, "10")),
                        food("4", "Kept again", nutrient(1008, "99"))));

        UsdaPage result = client.search("kept", 0, 20);

        assertThat(result.foods()).extracting(UsdaFood::name).containsExactly("Kept");
    }

    @Test
    @DisplayName("truncates long names and brands")
    void shouldTruncateNameAndBrand() {
        respondWith(
                page(
                        "{\"fdcId\":9,\"description\":\""
                                + "n".repeat(400)
                                + "\",\"brandName\":\""
                                + "b".repeat(250)
                                + "\",\"foodNutrients\":["
                                + nutrient(1008, "1")
                                + "]}"));

        UsdaFood mapped = client.search("long", 0, 20).foods().getFirst();

        assertThat(mapped.name()).hasSize(300);
        assertThat(mapped.brand()).hasSize(200);
    }

    @Test
    @DisplayName("returns an empty page for no results")
    void shouldReturnEmptyPage() {
        respondWith("{\"totalHits\":0,\"totalPages\":0,\"foods\":[]}");

        UsdaPage result = client.search("zzzz", 0, 20);

        assertThat(result.foods()).isEmpty();
        assertThat(result.totalHits()).isZero();
    }

    @Test
    @DisplayName("answers 503 on USDA rate limiting")
    void shouldReturnServiceUnavailableOnTooManyRequests() {
        usda.expect(method(HttpMethod.GET)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        assertUnavailable(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    @DisplayName("answers 503 on a USDA server error")
    void shouldReturnServiceUnavailableOnServerError() {
        usda.expect(method(HttpMethod.GET)).andRespond(withServerError());

        assertUnavailable(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    @DisplayName("answers 502 when USDA rejects the request")
    void shouldReturnBadGatewayOnClientError() {
        usda.expect(method(HttpMethod.GET)).andRespond(withBadRequest().body("secret details"));

        assertUnavailable(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("answers 502 on unparsable JSON")
    void shouldReturnBadGatewayOnGarbage() {
        respondWith("<html>not json");

        assertUnavailable(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("answers 502 on an empty body or one without a foods array")
    void shouldReturnBadGatewayOnEmptyBody() {
        respondWith("");
        assertUnavailable(HttpStatus.BAD_GATEWAY);

        usda.reset();
        respondWith("{\"totalHits\":0}");
        assertUnavailable(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("answers 503 without calling USDA when no API key is configured")
    void shouldReturnServiceUnavailableWithoutKey() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        UsdaClient keyless = new UsdaClient(config(BASE_URL, " ", Duration.ofSeconds(1)), builder);

        assertThatThrownBy(() -> keyless.search("chicken", 0, 20))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception ->
                                assertThat(exception.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        server.verify();
    }

    @Test
    @DisplayName("answers 503 when USDA is slower than the timeout")
    void shouldReturnServiceUnavailableOnTimeout() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    try {
                        Thread.sleep(1500);
                        exchange.sendResponseHeaders(200, -1);
                    } catch (InterruptedException | IOException ignored) {
                        Thread.currentThread().interrupt();
                    } finally {
                        exchange.close();
                    }
                });
        server.start();
        try {
            UsdaClient slow =
                    new UsdaClient(
                            config(
                                    "http://127.0.0.1:" + server.getAddress().getPort(),
                                    API_KEY,
                                    Duration.ofMillis(200)));

            assertThatThrownBy(() -> slow.search("chicken", 0, 20))
                    .isInstanceOfSatisfying(
                            FuelException.class,
                            exception -> {
                                assertThat(exception.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                                assertThat(exception.getMessage())
                                        .doesNotContain("127.0.0.1")
                                        .doesNotContain(API_KEY);
                            });
        } finally {
            server.stop(0);
        }
    }

    private static String branded(String fdcId, String gtin) {
        return "{\"fdcId\":"
                + fdcId
                + ",\"description\":\"Bar "
                + fdcId
                + "\",\"gtinUpc\":\""
                + gtin
                + "\",\"brandOwner\":\"Acme\",\"foodNutrients\":["
                + nutrient(1008, "200")
                + "]}";
    }

    @Test
    @DisplayName("searches branded foods by GTIN with the key in a header only")
    void shouldSearchBrandedByGtin() {
        usda.expect(
                        requestTo(
                                containsString(
                                        "/foods/search?query=023700011527&dataType=Branded&pageSize=25")))
                .andExpect(header("X-Api-Key", API_KEY))
                .andExpect(requestTo(not(containsString(API_KEY))))
                .andRespond(
                        withSuccess(
                                page(branded("1", "023700011527")), MediaType.APPLICATION_JSON));

        assertThat(client.findByGtin("023700011527"))
                .hasValueSatisfying(food -> assertThat(food.fdcId()).isEqualTo(1));
        usda.verify();
    }

    @Test
    @DisplayName("ignores fuzzy hits whose gtinUpc differs")
    void shouldIgnoreFuzzyGtinHits() {
        respondWith(page(branded("1", "999999999999"), branded("2", "023700011527")));

        assertThat(client.findByGtin("023700011527"))
                .hasValueSatisfying(food -> assertThat(food.fdcId()).isEqualTo(2));
    }

    @Test
    @DisplayName("matches a GTIN that differs only by leading zeros")
    void shouldMatchIgnoringLeadingZeros() {
        respondWith(page(branded("3", "23700011527")));

        assertThat(client.findByGtin("0023700011527"))
                .hasValueSatisfying(food -> assertThat(food.fdcId()).isEqualTo(3));
    }

    @Test
    @DisplayName("returns empty when no food has that GTIN")
    void shouldReturnEmptyWhenNoGtinMatches() {
        respondWith(page(branded("1", "999999999999")));

        assertThat(client.findByGtin("023700011527")).isEmpty();
    }

    @Test
    @DisplayName("returns empty when the matching food has no calories")
    void shouldReturnEmptyWhenMatchHasNoNutrition() {
        respondWith(
                page(
                        "{\"fdcId\":4,\"description\":\"Bar\",\"gtinUpc\":\"023700011527\","
                                + "\"foodNutrients\":[]}"));

        assertThat(client.findByGtin("023700011527")).isEmpty();
    }

    @Test
    @DisplayName("maps GTIN lookup failures like search")
    void shouldMapGtinFailures() {
        usda.expect(method(HttpMethod.GET)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertGtinFails(HttpStatus.SERVICE_UNAVAILABLE);
        usda.reset();

        usda.expect(method(HttpMethod.GET)).andRespond(withServerError());
        assertGtinFails(HttpStatus.SERVICE_UNAVAILABLE);
        usda.reset();

        usda.expect(method(HttpMethod.GET)).andRespond(withBadRequest());
        assertGtinFails(HttpStatus.BAD_GATEWAY);
        usda.reset();

        respondWith("{not json");
        assertGtinFails(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("returns 503 for a GTIN lookup without calling USDA when no key is set")
    void shouldSkipGtinLookupWithoutKey() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer none = MockRestServiceServer.bindTo(builder).build();
        UsdaClient unconfigured =
                new UsdaClient(config(BASE_URL, "", Duration.ofSeconds(5)), builder);

        assertThatThrownBy(() -> unconfigured.findByGtin("023700011527"))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception ->
                                assertThat(exception.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        none.verify();
    }

    private void assertGtinFails(HttpStatus expected) {
        assertThatThrownBy(() -> client.findByGtin("023700011527"))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception -> {
                            assertThat(exception.getHttpStatus()).isEqualTo(expected);
                            assertThat(exception.getMessage())
                                    .isEqualTo("Food search is temporarily unavailable");
                        });
    }

    private void assertUnavailable(HttpStatus expected) {
        assertThatThrownBy(() -> client.search("chicken", 0, 20))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception -> {
                            assertThat(exception.getHttpStatus()).isEqualTo(expected);
                            assertThat(exception.getMessage())
                                    .isEqualTo("Food search is temporarily unavailable");
                        });
    }
}
