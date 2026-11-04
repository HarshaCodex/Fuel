package com.lazybuff.fuel.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Runs the real Flyway migrations (including V10) against PostgreSQL. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("body_stats migration")
class BodyStatsRepositoryTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            // V6 builds a trigram index but no migration creates the extension (provisioned on the
            // hosted database), so a fresh container needs it up front.
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private JdbcTemplate jdbc;

    @Autowired private BodyStatsRepository bodyStatsRepository;

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                id,
                id + "@example.com");
        return id;
    }

    private void insertStats(
            UUID userId, double height, double weight, int age, String gender, String activity) {
        jdbc.update(
                "INSERT INTO body_stats (user_id, height_cm, weight_kg, age, gender, activity_level)"
                        + " VALUES (?, ?, ?, ?, ?, ?)",
                userId,
                height,
                weight,
                age,
                gender,
                activity);
    }

    private void assertRejected(
            double height, double weight, int age, String gender, String activity) {
        UUID user = insertUser();
        assertThatThrownBy(() -> insertStats(user, height, weight, age, gender, activity))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("applies V10 and finds a row by user id")
    void shouldFindStatsByUserId() {
        UUID user = insertUser();
        insertStats(user, 175.0, 72.5, 25, "MALE", "MODERATE");

        assertThat(bodyStatsRepository.findByUser_Id(user))
                .hasValueSatisfying(
                        s -> {
                            assertThat(s.getHeightCm()).isEqualByComparingTo("175.0");
                            assertThat(s.getUpdatedAt()).isNotNull();
                        });
        assertThat(bodyStatsRepository.findByUser_Id(UUID.randomUUID())).isEmpty();
    }

    @Test
    @DisplayName("rejects a second row for the same user")
    void shouldRejectSecondRowForUser() {
        UUID user = insertUser();
        insertStats(user, 175.0, 72.5, 25, "MALE", "MODERATE");

        assertThatThrownBy(() -> insertStats(user, 170.0, 70.0, 30, "FEMALE", "LIGHT"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @ParameterizedTest
    @CsvSource({
        "49.9, 70, 25, MALE, LIGHT",
        "300.1, 70, 25, MALE, LIGHT",
        "175, 19.9, 25, MALE, LIGHT",
        "175, 300.1, 25, MALE, LIGHT",
        "175, 70, 12, MALE, LIGHT",
        "175, 70, 121, MALE, LIGHT",
        "175, 70, 25, OTHER, LIGHT",
        "175, 70, 25, MALE, EXTREME"
    })
    @DisplayName("rejects out-of-range numbers and unknown gender or activity level")
    void shouldRejectInvalidRow(
            double height, double weight, int age, String gender, String activity) {
        assertRejected(height, weight, age, gender, activity);
    }

    @Test
    @DisplayName("accepts values exactly on the boundaries")
    void shouldAcceptBoundaries() {
        insertStats(insertUser(), 50.0, 20.0, 13, "FEMALE", "SEDENTARY");
        insertStats(insertUser(), 300.0, 300.0, 120, "MALE", "VERY_ACTIVE");
    }

    @Test
    @DisplayName("deleting the user cascades to its body stats")
    void shouldCascadeOnUserDelete() {
        UUID user = insertUser();
        insertStats(user, 175.0, 72.5, 25, "MALE", "MODERATE");

        jdbc.update("DELETE FROM users WHERE id = ?", user);

        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM body_stats WHERE user_id = ?",
                                Integer.class,
                                user))
                .isZero();
    }
}
