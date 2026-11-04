package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import com.lazybuff.fuel.service.OffClient.OffFood;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@DisplayName("OffClient")
class OffClientTest {

    private static final String BASE_URL = "https://off.test";
    private static final String USER_AGENT = "Fuel/1.0 (test)";

    private MockRestServiceServer off;

    private OffClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        off = MockRestServiceServer.bindTo(builder).build();
        client = new OffClient(config(BASE_URL, USER_AGENT, Duration.ofSeconds(5)), builder);
    }

    private static FoodSearchConfig config(String baseUrl, String userAgent, Duration timeout) {
        FoodSearchConfig config = new FoodSearchConfig();
        config.getOff().setBaseUrl(baseUrl);
        config.getOff().setUserAgent(userAgent);
        config.getOff().setHttpTimeout(timeout);
        config.getOff().setMaxResults(10);
        return config;
    }

    private void respondWith(String json) {
        off.expect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    private static String product(String code, String name, String brands, String nutriments) {
        return "{\"code\":"
                + code
                + ",\"product_name\":\""
                + name
                + "\",\"brands\":\""
                + brands
                + "\",\"nutriments\":{"
                + nutriments
                + "},\"unknown_field\":[1,2]}";
    }

    private static String products(String... items) {
        return "{\"count\":9,\"products\":[" + String.join(",", items) + "]}";
    }

    private static final String VALID =
            "\"energy-kcal_100g\":250.46,\"proteins_100g\":5.005,\"carbohydrates_100g\":30,"
                    + "\"fat_100g\":10.1,\"fiber_100g\":2";

    private List<OffFood> search() {
        return client.search("granola");
    }

    @Test
    @DisplayName("maps a product to per-100 g nutrients, scaled, with the first brand")
    void shouldMapProduct() {
        respondWith(products(product("\"3017620422003\"", " Granola ", " , Acme , Other", VALID)));

        List<OffFood> foods = search();

        assertThat(foods).hasSize(1);
        OffFood food = foods.getFirst();
        assertThat(food.code()).isEqualTo("3017620422003");
        assertThat(food.sourceId()).isEqualTo("3017620422003");
        assertThat(food.name()).isEqualTo("Granola");
        assertThat(food.brand()).isEqualTo("Acme");
        assertThat(food.calories()).isEqualTo(new java.math.BigDecimal("250.5"));
        assertThat(food.protein()).isEqualTo(new java.math.BigDecimal("5.01"));
        assertThat(food.carbs()).isEqualTo(new java.math.BigDecimal("30.00"));
        assertThat(food.fat()).isEqualTo(new java.math.BigDecimal("10.10"));
        assertThat(food.fiber()).isEqualTo(new java.math.BigDecimal("2.00"));
    }

    @Test
    @DisplayName("sends the configured User-Agent and the search parameters")
    void shouldSendUserAgentAndParameters() {
        off.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE_URL + "/cgi/search.pl?")))
                .andExpect(header("User-Agent", USER_AGENT))
                .andExpect(queryParam("search_terms", "granola"))
                .andExpect(queryParam("json", "1"))
                .andExpect(queryParam("page_size", "10"))
                .andExpect(queryParam("page", "1"))
                .andExpect(queryParam("fields", "code,product_name,brands,nutriments"))
                .andRespond(withSuccess(products(), MediaType.APPLICATION_JSON));

        assertThat(search()).isEmpty();
        off.verify();
    }

    @Test
    @DisplayName("percent-encodes the query so it cannot add parameters or break the URL")
    void shouldEncodeQuery() {
        String query = "50% off & more=1 🍫#x";
        off.expect(
                        requestTo(
                                org.hamcrest.Matchers.allOf(
                                        org.hamcrest.Matchers.containsString("search_terms="),
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.containsString(" ")),
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.containsString("&more=")),
                                        org.hamcrest.Matchers.not(
                                                org.hamcrest.Matchers.containsString("#")),
                                        org.hamcrest.Matchers.containsString("%25"),
                                        org.hamcrest.Matchers.containsString("%26"))))
                .andExpect(
                        requestTo(
                                org.hamcrest.Matchers.containsString(
                                        "search_terms=50%25%20off%20%26%20more%3D1%20"
                                                + "%F0%9F%8D%AB%23x&search_simple=1")))
                .andRespond(withSuccess(products(), MediaType.APPLICATION_JSON));

        assertThat(client.search(query)).isEmpty();
        off.verify();
    }

    @Test
    @DisplayName("accepts numeric strings and treats other values as missing")
    void shouldReadNumericStrings() {
        respondWith(
                products(
                        product(
                                "\"111\"",
                                "Strings",
                                "",
                                "\"energy-kcal_100g\":\" 120.5 \",\"proteins_100g\":\"3\","
                                        + "\"carbohydrates_100g\":\"abc\",\"fat_100g\":null,"
                                        + "\"fiber_100g\":true")));

        OffFood food = search().getFirst();

        assertThat(food.calories()).isEqualByComparingTo("120.5");
        assertThat(food.protein()).isEqualByComparingTo("3");
        assertThat(food.carbs()).isEqualByComparingTo("0");
        assertThat(food.fat()).isEqualByComparingTo("0");
        assertThat(food.fiber()).isEqualByComparingTo("0");
        assertThat(food.brand()).isNull();
    }

    @Test
    @DisplayName("counts missing and negative macros as zero")
    void shouldZeroMissingAndNegativeMacros() {
        respondWith(
                products(product("\"111\"", "Odd", "", "\"energy-kcal_100g\":50,\"fat_100g\":-4")));

        OffFood food = search().getFirst();

        assertThat(food.fat()).isEqualByComparingTo("0");
        assertThat(food.protein()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("skips products without calories, including a zero-string typo")
    void shouldSkipWithoutCalories() {
        respondWith(
                products(
                        product("\"1\"", "No kcal", "", "\"proteins_100g\":3"),
                        product("\"2\"", "Text kcal", "", "\"energy-kcal_100g\":\"lots\""),
                        product("\"3\"", "Kept", "", "\"energy-kcal_100g\":0")));

        assertThat(search()).extracting(OffFood::name).containsExactly("Kept");
    }

    @Test
    @DisplayName("skips products with a blank name")
    void shouldSkipBlankName() {
        respondWith(
                products(
                        product("\"1\"", "   ", "", VALID),
                        "{\"code\":\"2\",\"nutriments\":{" + VALID + "}}"));

        assertThat(search()).isEmpty();
    }

    @Test
    @DisplayName("skips products whose code is absent, non-numeric or longer than 32 digits")
    void shouldSkipBadCodes() {
        respondWith(
                products(
                        product("\"abc\"", "Letters", "", VALID),
                        product("\"12 34\"", "Space", "", VALID),
                        product("\"\"", "Empty", "", VALID),
                        product("\"-5\"", "Negative", "", VALID),
                        product("\"" + "1".repeat(33) + "\"", "Too long", "", VALID),
                        "{\"product_name\":\"No code\",\"nutriments\":{" + VALID + "}}",
                        product("\"" + "1".repeat(32) + "\"", "Max length", "", VALID)));

        assertThat(search()).extracting(OffFood::name).containsExactly("Max length");
    }

    @Test
    @DisplayName("accepts a numeric JSON code and trims a padded one")
    void shouldAcceptNumericAndPaddedCodes() {
        respondWith(
                products(
                        product("12345", "Numeric", "", VALID),
                        product("\" 678 \"", "Padded", "", VALID)));

        assertThat(search()).extracting(OffFood::code).containsExactly("12345", "678");
    }

    @Test
    @DisplayName("skips products over 1000 kcal or with a macro over 100 g, keeps the limits")
    void shouldSkipOutOfRangeValues() {
        respondWith(
                products(
                        product("\"1\"", "Too many kcal", "", "\"energy-kcal_100g\":1000.1"),
                        product("\"2\"", "Max kcal", "", "\"energy-kcal_100g\":1000"),
                        product("\"3\"", "Negative kcal", "", "\"energy-kcal_100g\":-1"),
                        product(
                                "\"4\"",
                                "Protein",
                                "",
                                "\"energy-kcal_100g\":1,\"proteins_100g\":100.01"),
                        product(
                                "\"5\"",
                                "Carbs",
                                "",
                                "\"energy-kcal_100g\":1,\"carbohydrates_100g\":101"),
                        product("\"6\"", "Fat", "", "\"energy-kcal_100g\":1,\"fat_100g\":150"),
                        product("\"7\"", "Fiber", "", "\"energy-kcal_100g\":1,\"fiber_100g\":101"),
                        product(
                                "\"8\"",
                                "Max macro",
                                "",
                                "\"energy-kcal_100g\":1,\"fat_100g\":100")));

        assertThat(search()).extracting(OffFood::name).containsExactly("Max kcal", "Max macro");
    }

    @Test
    @DisplayName("truncates long names to 300 and brands to 200 characters")
    void shouldTruncateNameAndBrand() {
        respondWith(
                products(product("\"1\"", "n".repeat(400), "b".repeat(300) + ", other", VALID)));

        OffFood food = search().getFirst();

        assertThat(food.name()).hasSize(300);
        assertThat(food.brand()).hasSize(200);
    }

    @Test
    @DisplayName("keeps the first of two products with the same code")
    void shouldDropDuplicateCodes() {
        respondWith(
                products(
                        product("\"1\"", "First", "", VALID),
                        product("\"1\"", "Second", "", VALID),
                        product("\"2\"", "Other", "", VALID)));

        assertThat(search()).extracting(OffFood::name).containsExactly("First", "Other");
    }

    @Test
    @DisplayName("returns an empty list when OFF finds nothing or nothing is usable")
    void shouldReturnEmptyList() {
        respondWith(products());
        assertThat(search()).isEmpty();

        off.reset();
        respondWith(products(product("\"1\"", "Unusable", "", "\"fat_100g\":1")));
        assertThat(search()).isEmpty();
    }

    @Test
    @DisplayName("answers 503 when OFF rate limits or fails")
    void shouldReturnServiceUnavailableOnRetryableStatus() {
        off.expect(method(HttpMethod.GET)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertUnavailable(HttpStatus.SERVICE_UNAVAILABLE);

        off.reset();
        off.expect(method(HttpMethod.GET)).andRespond(withServerError());
        assertUnavailable(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    @DisplayName("answers 502 when OFF rejects the request")
    void shouldReturnBadGatewayOnClientError() {
        off.expect(method(HttpMethod.GET)).andRespond(withBadRequest());

        assertUnavailable(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("answers 502 for garbage, an empty body, or no products array")
    void shouldReturnBadGatewayOnUnusableBody() {
        respondWith("<html>not json</html>");
        assertUnavailable(HttpStatus.BAD_GATEWAY);

        off.reset();
        respondWith("");
        assertUnavailable(HttpStatus.BAD_GATEWAY);

        off.reset();
        respondWith("{\"count\":0}");
        assertUnavailable(HttpStatus.BAD_GATEWAY);

        off.reset();
        respondWith("{\"products\":null}");
        assertUnavailable(HttpStatus.BAD_GATEWAY);

        off.reset();
        respondWith("{\"products\":{}}");
        assertUnavailable(HttpStatus.BAD_GATEWAY);
    }

    @Test
    @DisplayName("tolerates non-object entries in the products array")
    void shouldIgnoreJunkEntries() {
        respondWith(products("null", "5", "\"text\"", "[]", product("\"1\"", "Fine", "", VALID)));

        assertThat(search()).extracting(OffFood::name).containsExactly("Fine");
    }

    @Test
    @DisplayName("answers 503 without calling OFF when no User-Agent is configured")
    void shouldReturnServiceUnavailableWithoutUserAgent() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OffClient anonymous = new OffClient(config(BASE_URL, " ", Duration.ofSeconds(1)), builder);

        assertThatThrownBy(() -> anonymous.search("granola"))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception ->
                                assertThat(exception.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        server.verify();
    }

    @Test
    @DisplayName("answers 503 when OFF is slower than the timeout")
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
            OffClient slow =
                    new OffClient(
                            config(
                                    "http://127.0.0.1:" + server.getAddress().getPort(),
                                    USER_AGENT,
                                    Duration.ofMillis(200)));

            assertThatThrownBy(() -> slow.search("granola"))
                    .isInstanceOfSatisfying(
                            FuelException.class,
                            exception -> {
                                assertThat(exception.getHttpStatus())
                                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                                assertThat(exception.getMessage())
                                        .doesNotContain("127.0.0.1")
                                        .doesNotContain("granola");
                            });
        } finally {
            server.stop(0);
        }
    }

    private void assertUnavailable(HttpStatus expected) {
        assertThatThrownBy(this::search)
                .isInstanceOfSatisfying(
                        FuelException.class,
                        exception -> {
                            assertThat(exception.getHttpStatus()).isEqualTo(expected);
                            assertThat(exception.getMessage())
                                    .isEqualTo("Food search is temporarily unavailable");
                        });
    }
}
