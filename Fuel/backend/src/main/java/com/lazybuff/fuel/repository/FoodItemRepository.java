package com.lazybuff.fuel.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.lazybuff.fuel.entity.FoodItem;

@Repository
public interface FoodItemRepository extends JpaRepository<FoodItem, String> {

    @EntityGraph(attributePaths = "servingSizes")
    Optional<FoodItem> findWithServingSizesById(UUID id);

}
