package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Runs the real service and repository against PostgreSQL to check the upsert and limits. */
@DataJpaTest
@Testcontainers
@Import(GoalsService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("GoalsService against PostgreSQL")
class GoalsServiceIntegrationTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private GoalsService service;

    @Autowired private UserGoalsRepository userGoalsRepository;

    @Autowired private JdbcTemplate jdbc;

    private UUID newUser() {
        UUID userId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                userId,
                userId + "@example.com");
        return userId;
    }

    private static GoalsRequest request(String calories, String macro) {
        BigDecimal value = new BigDecimal(macro);
        return new GoalsRequest(Integer.valueOf(calories), value, value, value);
    }

    @Test
    @DisplayName("reading goals creates no row")
    void shouldNotCreateRowOnGet() {
        UUID userId = newUser();

        GoalsResponse data = service.get(userId).getData();

        assertThat(data.calorieGoal()).isEqualTo(2000);
        assertThat(userGoalsRepository.count()).isZero();
    }

    @Test
    @DisplayName("keeps one row, stores 9999.9 and bumps updatedAt even for identical values")
    void shouldKeepOneRowAndBumpUpdatedAtOnRepeatedPut() {
        UUID userId = newUser();

        GoalsResponse first = service.put(userId, request("1800", "150")).getData();
        GoalsResponse max = service.put(userId, request("1800", "9999.9")).getData();
        GoalsResponse identical = service.put(userId, request("1800", "9999.9")).getData();

        assertThat(userGoalsRepository.count()).isEqualTo(1);
        assertThat(first.updatedAt()).isNotNull();
        assertThat(max.proteinGoal()).isEqualTo(9999.9);
        assertThat(max.updatedAt()).isAfter(first.updatedAt());
        assertThat(identical.updatedAt()).isAfter(max.updatedAt());
        assertThat(service.getGoals(userId).fatGoal()).isEqualTo(9999.9);
    }
}
