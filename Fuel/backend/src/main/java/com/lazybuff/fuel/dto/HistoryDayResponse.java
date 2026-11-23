package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Totals for one day that has entries. */
@Schema(description = "Nutrient totals for one day that has entries")
public record HistoryDayResponse(
        @Schema(
                        description = "The diary day (the entry's stored local date)",
                        example = "2026-06-09")
                LocalDate date,
        @Schema(description = "Calories eaten that day", example = "1450") BigDecimal calories,
        @Schema(
                        description = "The user's current calorie goal, same on every row",
                        example = "2200")
                int calorieGoal,
        @Schema(description = "Protein in grams", example = "120.5") BigDecimal protein,
        @Schema(description = "Carbohydrates in grams", example = "140.0") BigDecimal carbs,
        @Schema(description = "Fat in grams", example = "45.2") BigDecimal fat,
        @Schema(description = "Fibre in grams", example = "18.0") BigDecimal fiber,
        @Schema(description = "Number of entries that day", example = "6") int entryCount) {}
