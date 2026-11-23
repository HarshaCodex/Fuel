package com.lazybuff.fuel.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** One food in search results. Nutrients are for the given serving (USDA foods: 100 g). */
public record FoodSearchItem(
        UUID id,
        String name,
        String brand,
        String source,
        String sourceId,
        BigDecimal servingSize,
        String servingUnit,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbs,
        BigDecimal fat,
        BigDecimal fiber) {}
