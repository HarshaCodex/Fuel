package com.lazybuff.fuel.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lazybuff.fuel.entity.TrackingEntry;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Runs the real Flyway migrations (including V11) against PostgreSQL. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("tracking_entries migration")
class TrackingEntryRepositoryTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private JdbcTemplate jdbc;

    @Autowired private TrackingEntryRepository trackingEntryRepository;

    @Autowired private UserRepository userRepository;

    @Autowired private EntityManager entityManager;

    private UUID insertUser(String deletedAt) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name, deleted_at) VALUES (?, ?, 'Test',"
                        + " ?::timestamptz)",
                id,
                id + "@example.com",
                deletedAt);
        return id;
    }

    private UUID insertFood() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO food_items (id, name, source, source_id, serving_size, serving_unit,"
                        + " calories, protein, carbs, fat)"
                        + " VALUES (?, 'Rice', 'USDA', ?, 100, 'g', 130, 2.7, 28, 0.3)",
                id,
                "src-" + id);
        return id;
    }

    private void insertEntry(UUID userId, UUID foodId, String meal) {
        jdbc.update(
                "INSERT INTO tracking_entries (user_id, food_id, food_name, food_source,"
                        + " serving_size, serving_unit, quantity, meal_label, logged_at, log_date,"
                        + " calories, protein, carbs, fat)"
                        + " VALUES (?, ?, 'Rice', 'USDA', 100, 'g', 1, ?, NOW(), CURRENT_DATE,"
                        + " 130, 2.7, 28, 0.3)",
                userId,
                foodId,
                meal);
    }

    private void insertEntryOn(UUID userId, UUID foodId, String logDate, boolean deleted) {
        jdbc.update(
                "INSERT INTO tracking_entries (user_id, food_id, food_name, food_source,"
                        + " serving_size, serving_unit, quantity, meal_label, logged_at, log_date,"
                        + " calories, protein, carbs, fat, deleted_at)"
                        + " VALUES (?, ?, 'Rice', 'USDA', 100, 'g', 1, 'lunch', NOW(),"
                        + " ?::date, 130, 2.7, 28, 0.3, CASE WHEN ? THEN NOW() END)",
                userId,
                foodId,
                logDate,
                deleted);
    }

    private int countEntries(UUID userId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM tracking_entries WHERE user_id = ?", Integer.class, userId);
    }

    @Test
    @DisplayName("saves and reloads an entry with its scale and lowercase serving unit")
    void shouldRoundTripEntry() {
        UUID userId = insertUser(null);
        User user = userRepository.getReferenceById(userId);
        UUID foodId = insertFood();
        TrackingEntry saved =
                trackingEntryRepository.saveAndFlush(
                        TrackingEntry.builder()
                                .user(user)
                                .foodId(foodId)
                                .foodName("Rice")
                                .foodSource(FoodSource.USDA)
                                .servingSize(new BigDecimal("150.0"))
                                .servingUnit(ServingUnit.G)
                                .quantity(new BigDecimal("1.50"))
                                .loggedAt(
                                        OffsetDateTime.of(2026, 6, 10, 18, 0, 0, 0, ZoneOffset.UTC))
                                .logDate(LocalDate.of(2026, 6, 10))
                                .calories(new BigDecimal("247.5"))
                                .protein(new BigDecimal("46.50"))
                                .carbs(new BigDecimal("0.00"))
                                .fat(new BigDecimal("5.40"))
                                .build());
        entityManager.flush();
        entityManager.clear();

        assertThat(
                        jdbc.queryForObject(
                                "SELECT serving_unit FROM tracking_entries WHERE id = ?",
                                String.class,
                                saved.getId()))
                .isEqualTo("g");
        assertThat(trackingEntryRepository.findById(saved.getId()))
                .hasValueSatisfying(
                        e -> {
                            assertThat(e.getServingUnit()).isEqualTo(ServingUnit.G);
                            assertThat(e.getQuantity()).isEqualTo(new BigDecimal("1.50"));
                            assertThat(e.getServingSize()).isEqualTo(new BigDecimal("150.0"));
                            assertThat(e.getCalories()).isEqualTo(new BigDecimal("247.5"));
                            assertThat(e.getProtein()).isEqualTo(new BigDecimal("46.50"));
                            assertThat(e.getFiber()).isEqualTo(new BigDecimal("0.00"));
                            assertThat(e.getLogDate()).isEqualTo(LocalDate.of(2026, 6, 10));
                            assertThat(e.getLoggedAt().toInstant())
                                    .isEqualTo(Instant.parse("2026-06-10T18:00:00Z"));
                            assertThat(e.getCreatedAt()).isNotNull();
                        });
    }

    @Test
    @DisplayName("creates the user and date index")
    void shouldCreateUserDateIndex() {
        assertThat(
                        jdbc.queryForList(
                                "SELECT indexname FROM pg_indexes WHERE tablename ="
                                        + " 'tracking_entries'",
                                String.class))
                .contains("idx_tracking_user_date");
    }

    @Test
    @DisplayName("rejects an unknown meal label")
    void shouldRejectBadMealLabel() {
        UUID user = insertUser(null);
        UUID food = insertFood();

        assertThatThrownBy(() -> insertEntry(user, food, "brunch"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("deleting the user cascades to its entries")
    void shouldCascadeOnUserDelete() {
        UUID user = insertUser(null);
        insertEntry(user, insertFood(), "lunch");

        jdbc.update("DELETE FROM users WHERE id = ?", user);

        assertThat(countEntries(user)).isZero();
    }

    @Test
    @DisplayName("deleteEntriesOfUsersDeletedBefore removes only the purged users' entries")
    void shouldDeleteOnlyEntriesOfPurgedUsers() {
        UUID food = insertFood();
        UUID purged = insertUser("2026-01-01T00:00:00Z");
        UUID recentlyDeleted = insertUser("2026-06-01T00:00:00Z");
        UUID active = insertUser(null);
        insertEntry(purged, food, null);
        insertEntry(recentlyDeleted, food, null);
        insertEntry(active, food, null);

        int deleted =
                trackingEntryRepository.deleteEntriesOfUsersDeletedBefore(
                        Instant.parse("2026-03-01T00:00:00Z"));

        assertThat(deleted).isEqualTo(1);
        assertThat(countEntries(purged)).isZero();
        assertThat(countEntries(recentlyDeleted)).isEqualTo(1);
        assertThat(countEntries(active)).isEqualTo(1);
    }

    private UUID insertEntryAt(UUID userId, UUID foodId, String loggedAt, String logDate) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO tracking_entries (id, user_id, food_id, food_name, food_source,"
                        + " serving_size, serving_unit, quantity, logged_at, log_date,"
                        + " calories, protein, carbs, fat)"
                        + " VALUES (?, ?, ?, 'Rice', 'USDA', 100, 'g', 1, ?::timestamptz,"
                        + " ?::date, 130, 2.7, 28, 0.3)",
                id,
                userId,
                foodId,
                loggedAt,
                logDate);
        return id;
    }

    @Test
    @DisplayName("findByIdAndUserId returns empty for another user's entry")
    void shouldNotFindEntryOfAnotherUser() {
        UUID owner = insertUser(null);
        UUID other = insertUser(null);
        UUID entry = insertEntryAt(owner, insertFood(), "2026-06-09T08:00:00Z", "2026-06-09");

        assertThat(trackingEntryRepository.findByIdAndUserId(entry, owner)).isPresent();
        assertThat(trackingEntryRepository.findByIdAndUserId(entry, other)).isEmpty();
    }

    @Test
    @DisplayName("list returns only the user's rows of the date, oldest first")
    void shouldListOwnRowsOfDateInOrder() {
        UUID food = insertFood();
        UUID owner = insertUser(null);
        UUID other = insertUser(null);
        UUID late = insertEntryAt(owner, food, "2026-06-09T18:00:00Z", "2026-06-09");
        UUID early = insertEntryAt(owner, food, "2026-06-09T07:00:00Z", "2026-06-09");
        insertEntryAt(owner, food, "2026-06-10T07:00:00Z", "2026-06-10");
        insertEntryAt(other, food, "2026-06-09T09:00:00Z", "2026-06-09");

        var entries =
                trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                        owner, LocalDate.of(2026, 6, 9));

        assertThat(entries).extracting(TrackingEntry::getId).containsExactly(early, late);
    }

    @Test
    @DisplayName("soft-deleted rows are excluded from both queries")
    void shouldExcludeSoftDeletedRows() {
        UUID owner = insertUser(null);
        UUID entry = insertEntryAt(owner, insertFood(), "2026-06-09T08:00:00Z", "2026-06-09");
        jdbc.update("UPDATE tracking_entries SET deleted_at = NOW() WHERE id = ?", entry);

        assertThat(trackingEntryRepository.findByIdAndUserId(entry, owner)).isEmpty();
        assertThat(
                        trackingEntryRepository
                                .findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                                        owner, LocalDate.of(2026, 6, 9)))
                .isEmpty();
    }

    @Test
    @DisplayName("findDistinctLogDates returns each date once, newest first")
    void shouldReturnDistinctDatesDescending() {
        UUID userId = insertUser(null);
        UUID foodId = insertFood();
        insertEntryOn(userId, foodId, "2026-11-01", false);
        insertEntryOn(userId, foodId, "2026-11-03", false);
        insertEntryOn(userId, foodId, "2026-11-03", false);
        insertEntryOn(userId, foodId, "2026-11-02", false);

        assertThat(trackingEntryRepository.findDistinctLogDates(userId, LocalDate.of(2026, 11, 5)))
                .containsExactly(
                        LocalDate.of(2026, 11, 3),
                        LocalDate.of(2026, 11, 2),
                        LocalDate.of(2026, 11, 1));
    }

    @Test
    @DisplayName("findDistinctLogDates excludes other users")
    void shouldExcludeOtherUsersDates() {
        UUID userId = insertUser(null);
        UUID otherId = insertUser(null);
        UUID foodId = insertFood();
        insertEntryOn(userId, foodId, "2026-11-03", false);
        insertEntryOn(otherId, foodId, "2026-11-04", false);

        assertThat(trackingEntryRepository.findDistinctLogDates(userId, LocalDate.of(2026, 11, 5)))
                .isEqualTo(List.of(LocalDate.of(2026, 11, 3)));
    }

    @Test
    @DisplayName("findDistinctLogDates excludes soft-deleted entries")
    void shouldExcludeSoftDeletedDates() {
        UUID userId = insertUser(null);
        UUID foodId = insertFood();
        insertEntryOn(userId, foodId, "2026-11-03", false);
        insertEntryOn(userId, foodId, "2026-11-04", true);

        assertThat(trackingEntryRepository.findDistinctLogDates(userId, LocalDate.of(2026, 11, 5)))
                .isEqualTo(List.of(LocalDate.of(2026, 11, 3)));
    }

    @Test
    @DisplayName("findDistinctLogDates excludes dates after today")
    void shouldExcludeFutureDates() {
        UUID userId = insertUser(null);
        UUID foodId = insertFood();
        insertEntryOn(userId, foodId, "2026-11-05", false);
        insertEntryOn(userId, foodId, "2026-11-06", false);

        assertThat(trackingEntryRepository.findDistinctLogDates(userId, LocalDate.of(2026, 11, 5)))
                .isEqualTo(List.of(LocalDate.of(2026, 11, 5)));
    }
}
