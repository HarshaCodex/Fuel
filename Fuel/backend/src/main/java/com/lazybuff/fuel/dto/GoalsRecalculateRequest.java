package com.lazybuff.fuel.dto;

import com.lazybuff.fuel.util.GoalType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Optional input for a goals recalculation. Null fields fall back to MAINTAIN and 500 kcal. */
@Schema(description = "Goal and daily calorie deficit/surplus; both optional")
public record GoalsRecalculateRequest(
        @Schema(description = "Goal, default MAINTAIN", example = "LOSE") GoalType goal,
        @Schema(
                        description =
                                "Daily kcal deficit (LOSE) or surplus (GAIN), default 500;"
                                        + " ignored for MAINTAIN",
                        example = "500")
                @Min(100)
                @Max(1000)
                Integer deficit) {}
