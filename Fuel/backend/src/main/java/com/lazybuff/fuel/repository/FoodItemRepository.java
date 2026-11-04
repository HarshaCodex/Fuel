package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.util.FoodSource;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FoodItemRepository extends JpaRepository<FoodItem, UUID> {

    @EntityGraph(attributePaths = "servingSizes")
    Optional<FoodItem> findWithServingSizesById(UUID id);

    Optional<FoodItem> findByIdAndSourceAndUser_Id(UUID id, FoodSource source, UUID userId);

    /**
     * Live foods of {@code source} created by {@code userId}, newest first. The id breaks ties so
     * paging is stable.
     */
    Page<FoodItem> findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(
            FoodSource source, UUID userId, Pageable pageable);

    /**
     * Deletes the custom foods of accounts soft-deleted before {@code cutoff}. Run before purging
     * those users: the foreign key only sets {@code created_by} to null, which would leave the
     * foods behind. Serving sizes cascade.
     *
     * @return the number of foods deleted
     */
    @Modifying
    @Query(
            value =
                    """
                    DELETE FROM food_items
                    WHERE source = 'USER'
                      AND created_by IN (
                          SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff)
                    """,
            nativeQuery = true)
    int deleteCustomFoodsOfUsersDeletedBefore(@Param("cutoff") Instant cutoff);

    /**
     * Deletes custom foods created by unverified accounts created before {@code cutoff}, ahead of
     * {@link UserRepository#purgeUnverifiedCreatedBefore}, for the same reason as above.
     *
     * @return the number of foods deleted
     */
    @Modifying
    @Query(
            value =
                    """
                    DELETE FROM food_items
                    WHERE source = 'USER'
                      AND created_by IN (
                          SELECT id FROM users
                          WHERE email_verified = FALSE AND deleted_at IS NULL
                            AND created_at < :cutoff)
                    """,
            nativeQuery = true)
    int deleteCustomFoodsOfUnverifiedUsersCreatedBefore(@Param("cutoff") Instant cutoff);

    /**
     * Inserts a USDA food, or refreshes it when {@code (source, source_id)} already exists, in one
     * atomic statement backed by the partial unique index {@code uq_food_source_id}.
     *
     * @return the internal id of the inserted or updated row
     */
    @Query(
            value =
                    """
                    INSERT INTO food_items (name, brand, source, source_id, serving_size, serving_unit,
                                            calories, protein, carbs, fat, fiber)
                    VALUES (:name, :brand, 'USDA', :sourceId, :servingSize, :servingUnit,
                            :calories, :protein, :carbs, :fat, :fiber)
                    ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL AND deleted_at IS NULL
                    DO UPDATE SET name = EXCLUDED.name, brand = EXCLUDED.brand,
                                  serving_size = EXCLUDED.serving_size,
                                  serving_unit = EXCLUDED.serving_unit,
                                  calories = EXCLUDED.calories, protein = EXCLUDED.protein,
                                  carbs = EXCLUDED.carbs, fat = EXCLUDED.fat,
                                  fiber = EXCLUDED.fiber, updated_at = NOW()
                    RETURNING id
                    """,
            nativeQuery = true)
    UUID upsertUsdaFood(
            @Param("name") String name,
            @Param("brand") String brand,
            @Param("sourceId") String sourceId,
            @Param("servingSize") BigDecimal servingSize,
            @Param("servingUnit") String servingUnit,
            @Param("calories") BigDecimal calories,
            @Param("protein") BigDecimal protein,
            @Param("carbs") BigDecimal carbs,
            @Param("fat") BigDecimal fat,
            @Param("fiber") BigDecimal fiber);

    /**
     * Inserts an Open Food Facts product, or refreshes it when {@code (source, source_id)} already
     * exists, in one atomic statement backed by the partial unique index {@code uq_food_source_id}.
     *
     * @return the internal id of the inserted or updated row
     */
    @Query(
            value =
                    """
                    INSERT INTO food_items (name, brand, source, source_id, serving_size, serving_unit,
                                            calories, protein, carbs, fat, fiber)
                    VALUES (:name, :brand, 'OFF', :sourceId, :servingSize, :servingUnit,
                            :calories, :protein, :carbs, :fat, :fiber)
                    ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL AND deleted_at IS NULL
                    DO UPDATE SET name = EXCLUDED.name, brand = EXCLUDED.brand,
                                  serving_size = EXCLUDED.serving_size,
                                  serving_unit = EXCLUDED.serving_unit,
                                  calories = EXCLUDED.calories, protein = EXCLUDED.protein,
                                  carbs = EXCLUDED.carbs, fat = EXCLUDED.fat,
                                  fiber = EXCLUDED.fiber, updated_at = NOW()
                    RETURNING id
                    """,
            nativeQuery = true)
    UUID upsertOffFood(
            @Param("name") String name,
            @Param("brand") String brand,
            @Param("sourceId") String sourceId,
            @Param("servingSize") BigDecimal servingSize,
            @Param("servingUnit") String servingUnit,
            @Param("calories") BigDecimal calories,
            @Param("protein") BigDecimal protein,
            @Param("carbs") BigDecimal carbs,
            @Param("fat") BigDecimal fat,
            @Param("fiber") BigDecimal fiber);

    /**
     * The caller's live custom foods whose name contains {@code escapedQuery}, case-insensitively.
     * The caller must escape {@code \}, {@code %} and {@code _} in the query first.
     */
    @Query(
            """
            SELECT f FROM FoodItem f
            WHERE f.source = com.lazybuff.fuel.util.FoodSource.USER
              AND f.user.id = :userId
              AND lower(f.name) LIKE lower(concat('%', :q, '%')) ESCAPE '\\'
            ORDER BY f.name, f.id
            """)
    List<FoodItem> searchCustomFoods(
            @Param("userId") UUID userId, @Param("q") String escapedQuery, Pageable pageable);
}
