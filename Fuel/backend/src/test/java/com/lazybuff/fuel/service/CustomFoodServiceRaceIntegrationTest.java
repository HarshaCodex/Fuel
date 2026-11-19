package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.CustomFoodMapperImpl;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.util.FoodSource;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Interleaves real committed transactions to check an edit and a delete cannot overwrite each
 * other.
 */
@DataJpaTest
@Testcontainers
@Import({CustomFoodService.class, CustomFoodMapperImpl.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@DisplayName("CustomFoodService update and delete race against PostgreSQL")
class CustomFoodServiceRaceIntegrationTest {

    @Container @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Autowired private CustomFoodService service;

    @Autowired private FoodItemRepository foodItemRepository;

    @Autowired private JdbcTemplate jdbc;

    @Autowired private PlatformTransactionManager transactionManager;

    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO users (id, email, name) VALUES (?, ?, 'Test')",
                id,
                id + "@example.com");
        return id;
    }

    private UUID insertFood(UUID owner) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO food_items (id, name, source, serving_size, serving_unit, calories,"
                        + " protein, carbs, fat, created_by) VALUES (?, 'Original', 'USER', 100,"
                        + " 'g', 10, 1, 1, 1, ?)",
                id,
                owner);
        return id;
    }

    private static CustomFoodRequest request(String name) {
        return new CustomFoodRequest(
                name,
                null,
                new BigDecimal("200"),
                "g",
                new BigDecimal("180"),
                new BigDecimal("9"),
                new BigDecimal("24"),
                new BigDecimal("5"),
                null);
    }

    private TransactionTemplate template(int propagation) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(propagation);
        return template;
    }

    private Object deletedAt(UUID id) {
        return jdbc.queryForObject(
                "SELECT deleted_at FROM food_items WHERE id = ?", Object.class, id);
    }

    private String name(UUID id) {
        return jdbc.queryForObject("SELECT name FROM food_items WHERE id = ?", String.class, id);
    }

    private long version(UUID id) {
        return jdbc.queryForObject("SELECT version FROM food_items WHERE id = ?", Long.class, id);
    }

    @Test
    @DisplayName("an update that loaded before a delete committed fails and the food stays deleted")
    void shouldNotRestoreFoodWhenUpdateLoadedBeforeDeleteCommits() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);

        assertThatThrownBy(
                        () ->
                                template(TransactionDefinition.PROPAGATION_REQUIRED)
                                        .executeWithoutResult(
                                                status -> {
                                                    FoodItem loaded =
                                                            foodItemRepository
                                                                    .findByIdAndSourceAndUser_Id(
                                                                            food,
                                                                            FoodSource.USER,
                                                                            owner)
                                                                    .orElseThrow();
                                                    template(
                                                                    TransactionDefinition
                                                                            .PROPAGATION_REQUIRES_NEW)
                                                            .executeWithoutResult(
                                                                    inner ->
                                                                            service.delete(
                                                                                    owner, food));
                                                    loaded.setName("Edited after delete");
                                                    foodItemRepository.save(loaded);
                                                }))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);

        assertThat(deletedAt(food)).isNotNull();
        assertThat(name(food)).isEqualTo("Original");
    }

    @Test
    @DisplayName("a delete that loaded before an update committed fails and the edit survives")
    void shouldNotLoseEditWhenDeleteLoadedBeforeUpdateCommits() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);

        assertThatThrownBy(
                        () ->
                                template(TransactionDefinition.PROPAGATION_REQUIRED)
                                        .executeWithoutResult(
                                                status -> {
                                                    FoodItem loaded =
                                                            foodItemRepository
                                                                    .findByIdAndSourceAndUser_Id(
                                                                            food,
                                                                            FoodSource.USER,
                                                                            owner)
                                                                    .orElseThrow();
                                                    template(
                                                                    TransactionDefinition
                                                                            .PROPAGATION_REQUIRES_NEW)
                                                            .executeWithoutResult(
                                                                    inner ->
                                                                            service.update(
                                                                                    owner,
                                                                                    food,
                                                                                    request(
                                                                                            "Edited")));
                                                    loaded.setDeletedAt(OffsetDateTime.now());
                                                    foodItemRepository.save(loaded);
                                                }))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);

        assertThat(deletedAt(food)).isNull();
        assertThat(name(food)).isEqualTo("Edited");
    }

    @Test
    @DisplayName("an update after a committed delete is a plain 404, not a conflict")
    void shouldReturnNotFoundWhenUpdatingAfterDeleteCommitted() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);
        service.delete(owner, food);

        assertThatThrownBy(() -> service.update(owner, food, request("Late")))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus().value()).isEqualTo(404);
                            assertThat(e.getMessage()).isEqualTo("Food item not found");
                        });
        assertThat(deletedAt(food)).isNotNull();
    }

    @Test
    @DisplayName("a second delete after a committed delete is a plain 404")
    void shouldReturnNotFoundWhenDeletingTwice() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);
        service.delete(owner, food);

        assertThatThrownBy(() -> service.delete(owner, food))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus().value()).isEqualTo(404));
    }

    @Test
    @DisplayName("of two concurrent updates the second fails and the first edit wins")
    void shouldRejectSecondConcurrentUpdate() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);

        assertThatThrownBy(
                        () ->
                                template(TransactionDefinition.PROPAGATION_REQUIRED)
                                        .executeWithoutResult(
                                                status -> {
                                                    FoodItem loaded =
                                                            foodItemRepository
                                                                    .findByIdAndSourceAndUser_Id(
                                                                            food,
                                                                            FoodSource.USER,
                                                                            owner)
                                                                    .orElseThrow();
                                                    template(
                                                                    TransactionDefinition
                                                                            .PROPAGATION_REQUIRES_NEW)
                                                            .executeWithoutResult(
                                                                    inner ->
                                                                            service.update(
                                                                                    owner,
                                                                                    food,
                                                                                    request(
                                                                                            "First")));
                                                    loaded.setName("Second");
                                                    foodItemRepository.save(loaded);
                                                }))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);

        assertThat(name(food)).isEqualTo("First");
    }

    @Test
    @DisplayName("an existing row starts at version 0 and an update moves it to 1")
    void shouldStartAtVersionZeroAndIncrementOnUpdate() {
        UUID owner = insertUser();
        UUID food = insertFood(owner);
        assertThat(version(food)).isZero();

        service.update(owner, food, request("Edited"));

        assertThat(version(food)).isEqualTo(1L);
        assertThat(name(food)).isEqualTo("Edited");
    }
}
