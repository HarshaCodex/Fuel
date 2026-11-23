package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A food's current values plus when the user last logged it, as returned by the recents query. */
public record RecentFood(
        UUID id,
        String name,
        String brand,
        FoodSource source,
        BigDecimal servingSize,
        ServingUnit servingUnit,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbs,
        BigDecimal fat,
        OffsetDateTime lastLoggedAt) {}
