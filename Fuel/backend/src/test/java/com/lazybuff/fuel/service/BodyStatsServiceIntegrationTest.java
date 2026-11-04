package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.BodyStatsRequest;
import com.lazybuff.fuel.dto.BodyStatsResponse;
import com.lazybuff.fuel.repository.BodyStatsRepository;
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

/** Runs the real service and repository against PostgreSQL to check the upsert and timestamp. */
@DataJpaTest
@Testcontainers
@Import(BodyStatsService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("BodyStatsService against PostgreSQL")
class BodyStatsServiceIntegrationTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private BodyStatsService service;

    @Autowired private BodyStatsRepository bodyStatsRepository;

    @Autowired private JdbcTemplate jdbc;

    private static BodyStatsRequest request(String weight) {
        return new BodyStatsRequest(
                new BigDecimal("175"), "cm", new BigDecimal(weight), "kg", 25, "MALE", "MODERATE");
    }

    @Test
    @DisplayName("keeps one row and bumps updatedAt when saved twice, even with identical values")
    void shouldKeepOneRowAndBumpUpdatedAtOnRepeatedPut() {
        UUID userId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                userId,
                userId + "@example.com");

        BodyStatsResponse first = service.put(userId, request("72.5")).getData();
        BodyStatsResponse changed = service.put(userId, request("80")).getData();
        BodyStatsResponse identical = service.put(userId, request("80")).getData();

        assertThat(bodyStatsRepository.count()).isEqualTo(1);
        assertThat(first.getUpdatedAt()).isNotNull();
        assertThat(changed.getWeight()).isEqualByComparingTo("80");
        assertThat(changed.getUpdatedAt()).isAfter(first.getUpdatedAt());
        assertThat(identical.getUpdatedAt()).isAfter(changed.getUpdatedAt());
    }
}
