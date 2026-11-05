package com.lazybuff.fuel.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Runs the recents query against real PostgreSQL, including soft-delete filtering on both tables.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("TrackingEntryRepository.findRecentFoods")
class TrackingEntryRecentFoodsTest {

    private static final String BASE = "2026-01-10T12:00:00Z";

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private JdbcTemplate jdbc;

    @Autowired private TrackingEntryRepository repository;

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                id,
                id + "@example.com");
        return id;
    }

    private UUID insertFood(String name, String source, UUID createdBy, boolean deleted) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO food_items (id, name, source, source_id, serving_size, serving_unit,"
                        + " calories, protein, carbs, fat, created_by, deleted_at)"
                        + " VALUES (?, ?, ?, ?, 100, 'g', 130, 2.7, 28, 0.3, ?,"
                        + " CASE WHEN ? THEN NOW() END)",
                id,
                name,
                source,
                "USER".equals(source) ? null : "src-" + id,
                createdBy,
                deleted);
        return id;
    }

    private UUID insertFood(String name) {
        return insertFood(name, "USDA", null, false);
    }

    private void log(UUID userId, UUID foodId, OffsetDateTime at, boolean deleted) {
        jdbc.update(
                "INSERT INTO tracking_entries (user_id, food_id, food_name, food_source,"
                        + " serving_size, serving_unit, quantity, meal_label, logged_at, log_date,"
                        + " calories, protein, carbs, fat, deleted_at)"
                        + " VALUES (?, ?, 'Snapshot', 'USDA', 1, 'g', 1, 'lunch', ?, ?::date,"
                        + " 1, 1, 1, 1, CASE WHEN ? THEN NOW() END)",
                userId,
                foodId,
                at,
                at.toLocalDate().toString(),
                deleted);
    }

    private void log(UUID userId, UUID foodId, long minutesAfterBase) {
        log(userId, foodId, OffsetDateTime.parse(BASE).plusMinutes(minutesAfterBase), false);
    }

    private List<RecentFood> recent(UUID userId, int limit) {
        return repository.findRecentFoods(userId, PageRequest.of(0, limit));
    }

    @Test
    @DisplayName("returns a food logged three times once, with its newest log time")
    void shouldReturnDistinctFoodWithMaxLoggedAt() {
        UUID user = insertUser();
        UUID food = insertFood("Rice");
        log(user, food, 0);
        log(user, food, 30);
        log(user, food, 10);

        List<RecentFood> result = recent(user, 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(food);
        assertThat(result.get(0).lastLoggedAt().toInstant())
                .isEqualTo(OffsetDateTime.parse(BASE).plusMinutes(30).toInstant());
    }

    @Test
    @DisplayName("orders foods by their latest log time, newest first")
    void shouldOrderByMostRecentLog() {
        UUID user = insertUser();
        UUID a = insertFood("A");
        UUID b = insertFood("B");
        UUID c = insertFood("C");
        log(user, a, 5);
        log(user, b, 20);
        log(user, c, 10);
        log(user, a, 1);

        assertThat(recent(user, 10)).extracting(RecentFood::id).containsExactly(b, c, a);
    }

    @Test
    @DisplayName("breaks ties on identical log time by food id descending")
    void shouldBreakTiesByFoodIdDescending() {
        UUID user = insertUser();
        UUID a = insertFood("A");
        UUID b = insertFood("B");
        UUID c = insertFood("C");
        log(user, a, 0);
        log(user, b, 0);
        log(user, c, 0);

        // PostgreSQL orders uuids bytewise, which matches comparing their hex strings
        // (UUID.compareTo compares signed longs and would disagree).
        List<UUID> expected =
                Stream.of(a, b, c).sorted(Comparator.comparing(UUID::toString).reversed()).toList();
        assertThat(recent(user, 10)).extracting(RecentFood::id).containsExactlyElementsOf(expected);
    }

    @Test
    @DisplayName("ignores another user's entries")
    void shouldIgnoreOtherUsersEntries() {
        UUID me = insertUser();
        UUID other = insertUser();
        UUID mine = insertFood("Mine");
        UUID theirs = insertFood("Theirs");
        log(me, mine, 0);
        log(other, theirs, 50);
        log(other, mine, 60);

        List<RecentFood> result = recent(me, 10);

        assertThat(result).extracting(RecentFood::id).containsExactly(mine);
        assertThat(result.get(0).lastLoggedAt().toInstant())
                .isEqualTo(OffsetDateTime.parse(BASE).toInstant());
    }

    @Test
    @DisplayName("excludes a soft-deleted food even though a live entry references it")
    void shouldExcludeSoftDeletedFood() {
        UUID user = insertUser();
        UUID live = insertFood("Live");
        UUID gone = insertFood("Gone", "USDA", null, true);
        log(user, live, 0);
        log(user, gone, 50);

        assertThat(recent(user, 10)).extracting(RecentFood::id).containsExactly(live);
    }

    @Test
    @DisplayName("omits a food whose only entry is soft-deleted")
    void shouldOmitFoodWhoseOnlyEntryIsDeleted() {
        UUID user = insertUser();
        UUID food = insertFood("Rice");
        log(user, food, OffsetDateTime.parse(BASE), true);

        assertThat(recent(user, 10)).isEmpty();
    }

    @Test
    @DisplayName("uses the older live entry when the newer entry is soft-deleted")
    void shouldIgnoreDeletedNewerEntry() {
        UUID user = insertUser();
        UUID food = insertFood("Rice");
        log(user, food, OffsetDateTime.parse(BASE), false);
        log(user, food, OffsetDateTime.parse(BASE).plusHours(5), true);

        List<RecentFood> result = recent(user, 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).lastLoggedAt().toInstant())
                .isEqualTo(OffsetDateTime.parse(BASE).toInstant());
    }

    @Test
    @DisplayName("honours the page size as the limit, keeping the newest foods")
    void shouldHonourLimit() {
        UUID user = insertUser();
        UUID a = insertFood("A");
        UUID b = insertFood("B");
        UUID c = insertFood("C");
        log(user, a, 1);
        log(user, b, 2);
        log(user, c, 3);

        assertThat(recent(user, 2)).extracting(RecentFood::id).containsExactly(c, b);
    }

    @Test
    @DisplayName("returns an empty list when the user logged nothing")
    void shouldReturnEmptyWhenNothingLogged() {
        assertThat(recent(insertUser(), 10)).isEmpty();
    }

    @Test
    @DisplayName("includes a custom food the caller logged, with the current food values")
    void shouldIncludeCustomFoodWithLiveValues() {
        UUID user = insertUser();
        UUID food = insertFood("My Dal", "USER", user, false);
        log(user, food, 0);

        RecentFood item = recent(user, 10).get(0);

        assertThat(item.source()).isEqualTo(FoodSource.USER);
        assertThat(item.name()).isEqualTo("My Dal");
        assertThat(item.servingUnit()).isEqualTo(ServingUnit.G);
        assertThat(item.calories()).isEqualByComparingTo("130");
    }
}
