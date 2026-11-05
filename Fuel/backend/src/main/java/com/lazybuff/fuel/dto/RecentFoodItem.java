package com.lazybuff.fuel.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A food the caller logged recently, with its current values and the time of the newest log. */
public record RecentFoodItem(
        UUID id,
        String name,
        String brand,
        String source,
        BigDecimal servingSize,
        String servingUnit,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbs,
        BigDecimal fat,
        OffsetDateTime lastLoggedAt) {}
