package com.lazybuff.fuel.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.entity.FoodItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** The USDA upsert and the custom food name search, against real PostgreSQL. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("FoodItemRepository USDA search")
class FoodItemRepositoryUsdaSearchTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private JdbcTemplate jdbc;

    @Autowired private FoodItemRepository foodItemRepository;

    private UUID upsert(String sourceId, String name, String calories) {
        return foodItemRepository.upsertUsdaFood(
                name,
                null,
                sourceId,
                new BigDecimal("100"),
                "g",
                new BigDecimal(calories),
                new BigDecimal("1.00"),
                new BigDecimal("2.00"),
                new BigDecimal("3.00"),
                new BigDecimal("0.00"));
    }

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                id,
                id + "@example.com");
        return id;
    }

    private void insertFood(String name, String source, UUID owner, boolean deleted) {
        jdbc.update(
                "INSERT INTO food_items (name, source, source_id, serving_size, serving_unit,"
                        + " calories, protein, carbs, fat, created_by, deleted_at)"
                        + " VALUES (?, ?, ?, 100, 'g', 10, 1, 1, 1, ?, ?)",
                name,
                source,
                "USER".equals(source) ? null : "src-" + name,
                owner,
                deleted ? java.sql.Timestamp.from(Instant.now()) : null);
    }

    private List<String> search(UUID owner, String q) {
        return foodItemRepository.searchCustomFoods(owner, q, Pageable.ofSize(10)).stream()
                .map(FoodItem::getName)
                .toList();
    }

    @Test
    @DisplayName("upserting twice keeps one row, the same id and the newest nutrients")
    void shouldUpsertWithoutDuplicates() {
        UUID first = upsert("171077", "Chicken", "100.0");
        UUID second = upsert("171077", "Chicken, roasted", "165.5");

        assertThat(second).isEqualTo(first);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM food_items WHERE source_id = '171077'",
                                Integer.class))
                .isEqualTo(1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT calories FROM food_items WHERE id = ?",
                                BigDecimal.class,
                                first))
                .isEqualByComparingTo("165.5");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT name FROM food_items WHERE id = ?", String.class, first))
                .isEqualTo("Chicken, roasted");
    }

    @Test
    @DisplayName("different USDA ids get different rows")
    void shouldInsertDistinctFoods() {
        assertThat(upsert("1", "A food", "1.0")).isNotEqualTo(upsert("2", "A food", "1.0"));
    }

    @Test
    @DisplayName("custom search matches case-insensitively and only the caller's live custom foods")
    void shouldSearchOnlyCallersLiveCustomFoods() {
        UUID me = insertUser();
        UUID other = insertUser();
        insertFood("Chicken Curry", "USER", me, false);
        insertFood("Spicy chicken", "USER", me, false);
        insertFood("Chicken salad", "USER", other, false);
        insertFood("Chicken deleted", "USER", me, true);
        insertFood("Chicken usda", "USDA", null, false);
        insertFood("Beef", "USER", me, false);

        assertThat(search(me, "CHICKEN")).containsExactly("Chicken Curry", "Spicy chicken");
    }

    @Test
    @DisplayName("custom search treats % and _ literally")
    void shouldEscapeWildcards() {
        UUID me = insertUser();
        insertFood("100% juice", "USER", me, false);
        insertFood("1000 juice", "USER", me, false);
        insertFood("a_b", "USER", me, false);
        insertFood("axb", "USER", me, false);

        assertThat(search(me, "100\\%")).containsExactly("100% juice");
        assertThat(search(me, "a\\_b")).containsExactly("a_b");
        assertThat(search(me, "\\%\\%")).isEmpty();
    }
}
