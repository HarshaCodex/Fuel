package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.FoodItem;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
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
}
