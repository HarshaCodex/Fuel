package com.lazybuff.fuel.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.util.FoodSource;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Ownership and ordering of the custom food query, against real PostgreSQL. */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("FoodItemRepository custom foods")
class FoodItemRepositoryCustomFoodTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES =
            // V6 builds a trigram index but no migration creates the extension.
            new PostgreSQLContainer("postgres:16-alpine").withInitScript("pg-extensions.sql");

    @Autowired private JdbcTemplate jdbc;

    @Autowired private FoodItemRepository foodItemRepository;

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                id,
                id + "@example.com");
        return id;
    }

    private void insertFood(
            String name, String source, UUID owner, String createdAt, String deletedAt) {
        jdbc.update(
                "INSERT INTO food_items (id, name, source, source_id, serving_size, serving_unit,"
                        + " calories, protein, carbs, fat, created_by, created_at, deleted_at)"
                        + " VALUES (?, ?, ?, ?, 100, 'g', 10, 1, 1, 1, ?, ?::timestamptz,"
                        + " ?::timestamptz)",
                UUID.randomUUID(),
                name,
                source,
                "USER".equals(source) ? null : "src-" + name,
                owner,
                createdAt,
                deletedAt);
    }

    private Page<FoodItem> list(UUID owner, int page, int size) {
        return foodItemRepository.findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(
                FoodSource.USER, owner, PageRequest.of(page, size));
    }

    @Test
    @DisplayName("returns only the caller's live USER foods, newest first")
    void shouldReturnOnlyCallersLiveUserFoodsNewestFirst() {
        UUID a = insertUser();
        UUID b = insertUser();
        insertFood("a-old", "USER", a, "2026-01-01T00:00:00Z", null);
        insertFood("a-new", "USER", a, "2026-01-03T00:00:00Z", null);
        insertFood("a-mid", "USER", a, "2026-01-02T00:00:00Z", null);
        insertFood("a-deleted", "USER", a, "2026-01-04T00:00:00Z", "2026-01-05T00:00:00Z");
        insertFood("a-usda", "USDA", a, "2026-01-06T00:00:00Z", null);
        insertFood("b-food", "USER", b, "2026-01-07T00:00:00Z", null);

        Page<FoodItem> result = list(a, 0, 20);

        assertThat(result.getContent())
                .extracting(FoodItem::getName)
                .containsExactly("a-new", "a-mid", "a-old");
        assertThat(result.getTotalElements()).isEqualTo(3);
        assertThat(list(b, 0, 20).getContent())
                .extracting(FoodItem::getName)
                .containsExactly("b-food");
    }

    @Test
    @DisplayName("returns an empty page for a user with no custom foods")
    void shouldReturnEmptyPageForUserWithoutFoods() {
        UUID a = insertUser();
        insertFood("b-food", "USER", insertUser(), "2026-01-01T00:00:00Z", null);

        Page<FoodItem> result = list(a, 0, 20);

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isZero();
        assertThat(result.getTotalPages()).isZero();
    }

    @Test
    @DisplayName("pages with stable order when created_at ties")
    void shouldPageStablyWhenCreatedAtTies() {
        UUID a = insertUser();
        for (int i = 0; i < 5; i++) {
            insertFood("tie-" + i, "USER", a, "2026-01-01T00:00:00Z", null);
        }

        var first = list(a, 0, 2).getContent();
        var second = list(a, 1, 2).getContent();
        var third = list(a, 2, 2);

        assertThat(third.getTotalPages()).isEqualTo(3);
        assertThat(third.getContent()).hasSize(1);
        assertThat(first).doesNotContainAnyElementsOf(second);
        // PostgreSQL orders uuids as unsigned bytes, which matches the lowercase hex string order.
        assertThat(first)
                .extracting(f -> f.getId().toString())
                .isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }
}
