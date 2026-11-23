package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** One day's totals against the user's goals, the day's entries and the current streak. */
@Schema(description = "A day's totals against goals, its entries and the logging streak")
public record DashboardResponse(
        @Schema(description = "The day shown", example = "2026-11-04") LocalDate date,
        Calories calories,
        Macros macros,
        @Schema(description = "The day's entries, oldest first") List<DashboardEntry> entries,
        @Schema(description = "Streak as of today, not as of the requested date")
                StreakResponse streak) {

    /** Calories against the goal; remaining is negative when over the goal. */
    public record Calories(
            @Schema(example = "1450.5") BigDecimal consumed,
            @Schema(example = "2200") int goal,
            @Schema(example = "749.5") BigDecimal remaining) {}

    /** Macro totals against goals. */
    public record Macros(Macro protein, Macro carbs, Macro fat) {}

    /** One macro total against its goal. */
    public record Macro(
            @Schema(example = "82.4") BigDecimal consumed,
            @Schema(example = "150") double goal,
            @Schema(example = "g") String unit) {}

    /** A logged entry as shown on the dashboard. */
    public record DashboardEntry(
            UUID id,
            @Schema(example = "Oats") String foodName,
            @Schema(example = "SYSTEM") String source,
            @Schema(example = "breakfast", nullable = true) String mealLabel,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            OffsetDateTime loggedAt) {}
}
