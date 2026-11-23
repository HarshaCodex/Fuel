package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.GoalsRecalculateRequest;
import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.util.GoalType;
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
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

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

    private void insertBodyStats(UUID userId, int age, String height, String weight, String level) {
        jdbc.update(
                "INSERT INTO body_stats (user_id, height_cm, weight_kg, age, gender, activity_level)"
                        + " VALUES (?, ?::numeric, ?::numeric, ?, 'MALE', ?)",
                userId,
                height,
                weight,
                age,
                level);
    }

    @Test
    @DisplayName("recalculate stores values that satisfy the column checks at both clamps")
    void shouldStoreRecalculatedGoalsWithinConstraints() {
        UUID userId = newUser();
        insertBodyStats(userId, 30, "180.0", "80.0", "MODERATE");

        var lose = service.recalculate(userId, new GoalsRecalculateRequest(GoalType.LOSE, 1000));
        assertThat(lose.getData().calorieGoal()).isEqualTo(1759);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT calorie_adjustment FROM user_goals WHERE user_id = ?",
                                Integer.class,
                                userId))
                .isEqualTo(-1000);

        // A second user: the first user's body stats are already cached in the persistence context.
        UUID big = newUser();
        insertBodyStats(big, 13, "300.0", "300.0", "VERY_ACTIVE");
        var gain = service.recalculate(big, new GoalsRecalculateRequest(GoalType.GAIN, 1000));

        assertThat(gain.getData().calorieGoal()).isEqualTo(10000);
        assertThat(gain.getData().proteinGoal()).isEqualTo(1000.0);
        assertThat(service.getGoals(big).isAutoCalculated()).isTrue();
    }
}
