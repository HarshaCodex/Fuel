package com.lazybuff.fuel.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Settings for food search: the USDA FoodData Central client and the search behaviour. */
@Configuration
@ConfigurationProperties(prefix = "app.food")
@Getter
@Setter
public class FoodSearchConfig {

    private Usda usda = new Usda();

    private Search search = new Search();

    /** USDA FoodData Central connection. */
    @Getter
    @Setter
    public static class Usda {

        private String baseUrl;

        /** Free key from api.data.gov. A secret: env var / secret manager, never logged. */
        private String apiKey;

        /** Connect and read timeout for each USDA call. */
        private Duration httpTimeout;

        public boolean hasApiKey() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    /** How a search is served. */
    @Getter
    @Setter
    public static class Search {

        /** How long a USDA result page is served from Redis. */
        private Duration cacheTtl;

        /** Most of the caller's own foods added to the first page of results. */
        private int maxCustomResults;

        /** Most USDA lookups (cache misses) one user may trigger per rate-limit window. */
        private int rateLimit;

        /** Length of the per-user rate-limit window. */
        private Duration rateLimitWindow;
    }
}
