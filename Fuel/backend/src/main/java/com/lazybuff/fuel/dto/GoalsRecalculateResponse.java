package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** The recalculated goals plus how they were derived. */
@Schema(description = "Recalculated daily goals and the figures they came from")
public record GoalsRecalculateResponse(
        int calorieGoal,
        double proteinGoal,
        double carbGoal,
        double fatGoal,
        boolean isAutoCalculated,
        @Schema(description = "Estimated maintenance calories", example = "2500") int tdee,
        @Schema(description = "Deficit or surplus applied; 0 for MAINTAIN", example = "300")
                int deficit,
        @Schema(example = "MIFFLIN_ST_JEOR") String formula,
        @Schema(description = "Protein/carb/fat share of calories", example = "40/40/20")
                String macroSplit) {}
