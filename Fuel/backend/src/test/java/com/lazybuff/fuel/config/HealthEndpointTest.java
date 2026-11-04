package com.lazybuff.fuel.config;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lazybuff.fuel.controller.FoodItemController;
import com.lazybuff.fuel.security.RestAccessDeniedHandler;
import com.lazybuff.fuel.security.RestAuthEntryPoint;
import com.lazybuff.fuel.service.BarcodeService;
import com.lazybuff.fuel.service.CustomFoodService;
import com.lazybuff.fuel.service.FoodSearchService;
import com.lazybuff.fuel.service.FoodService;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.RateLimiterService;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.autoconfigure.endpoint.EndpointAutoConfiguration;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointAutoConfiguration;
import org.springframework.boot.actuate.autoconfigure.web.server.ManagementContextAutoConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.availability.ApplicationAvailabilityAutoConfiguration;
import org.springframework.boot.health.autoconfigure.actuate.endpoint.AvailabilityProbesAutoConfiguration;
import org.springframework.boot.health.autoconfigure.actuate.endpoint.HealthEndpointAutoConfiguration;
import org.springframework.boot.health.autoconfigure.application.AvailabilityHealthContributorAutoConfiguration;
import org.springframework.boot.health.autoconfigure.contributor.HealthContributorAutoConfiguration;
import org.springframework.boot.health.autoconfigure.registry.HealthContributorRegistryAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.health.DataSourceHealthContributorAutoConfiguration;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.autoconfigure.actuate.endpoint.web.WebMvcHealthEndpointExtensionAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Checks what the actuator exposes (#98), using the real properties and security rules but a mock
 * database, so it runs without Postgres.
 */
@WebMvcTest(FoodItemController.class)
@Import({
    SecurityConfig.class,
    RestAuthEntryPoint.class,
    RestAccessDeniedHandler.class,
    IpRateLimitConfig.class
})
@ImportAutoConfiguration({
    ApplicationAvailabilityAutoConfiguration.class,
    EndpointAutoConfiguration.class,
    WebEndpointAutoConfiguration.class,
    ManagementContextAutoConfiguration.class,
    HealthContributorAutoConfiguration.class,
    HealthContributorRegistryAutoConfiguration.class,
    HealthEndpointAutoConfiguration.class,
    WebMvcHealthEndpointExtensionAutoConfiguration.class,
    AvailabilityHealthContributorAutoConfiguration.class,
    AvailabilityProbesAutoConfiguration.class,
    DataSourceHealthContributorAutoConfiguration.class
})
@DisplayName("Health endpoint")
class HealthEndpointTest {

    @TestConfiguration
    static class MockDataSourceConfig {

        @Bean
        DataSource dataSource() {
            return mock(DataSource.class);
        }
    }

    @Autowired private MockMvc mockMvc;

    // A plain bean rather than @MockitoBean: the db health auto-configuration only applies when a
    // DataSource bean exists while configuration is parsed, which is before bean overrides apply.
    @Autowired private DataSource dataSource;

    @MockitoBean private JwtService jwtService;

    @MockitoBean private FoodService foodService;
    @MockitoBean private CustomFoodService customFoodService;
    @MockitoBean private FoodSearchService foodSearchService;

    @MockitoBean private BarcodeService barcodeService;

    @MockitoBean private RateLimiterService rateLimiterService;

    @AfterEach
    void resetDataSource() {
        reset(dataSource);
    }

    private void databaseUp() throws SQLException {
        Connection connection = mock(Connection.class);
        DatabaseMetaData metaData = mock(DatabaseMetaData.class);
        when(metaData.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(connection.getMetaData()).thenReturn(metaData);
        when(connection.isValid(anyInt())).thenReturn(true);
        when(dataSource.getConnection()).thenReturn(connection);
    }

    private void databaseDown() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/actuator/health",
                "/actuator/health/liveness",
                "/actuator/health/readiness"
            })
    @DisplayName("is public and reports UP when the database is reachable")
    void shouldReportUpWithoutAuthentication(String path) throws Exception {
        databaseUp();

        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("never shows component details to anonymous callers")
    void shouldHideComponentDetails() throws Exception {
        databaseUp();

        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components").doesNotExist())
                .andExpect(jsonPath("$.details").doesNotExist());
    }

    @Test
    @DisplayName("readiness is DOWN (503) when the database is unreachable")
    void shouldReportNotReadyWhenDatabaseDown() throws Exception {
        databaseDown();

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"));
    }

    @Test
    @DisplayName("liveness stays UP when the database is unreachable, so the app isn't restarted")
    void shouldStayLiveWhenDatabaseDown() throws Exception {
        databaseDown();

        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/actuator",
                "/actuator/env",
                "/actuator/beans",
                "/actuator/heapdump",
                "/actuator/configprops",
                "/actuator/loggers"
            })
    @DisplayName("doesn't let anonymous callers reach any other actuator endpoint")
    void shouldBlockOtherEndpoints(String path) throws Exception {
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
    }
}
