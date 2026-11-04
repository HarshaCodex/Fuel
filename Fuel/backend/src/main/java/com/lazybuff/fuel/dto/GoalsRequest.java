package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** Daily nutrition goals to save. Every field is required. */
@Schema(description = "Daily calorie and macro goals; every field is required")
public record GoalsRequest(
        @Schema(description = "Calories per day", example = "1800") @NotNull @Min(800) @Max(10000)
                Integer calorieGoal,
        @Schema(description = "Protein grams per day", example = "150.0")
                @NotNull
                @DecimalMin("0")
                @DecimalMax("9999.9")
                BigDecimal proteinGoal,
        @Schema(description = "Carbohydrate grams per day", example = "180.0")
                @NotNull
                @DecimalMin("0")
                @DecimalMax("9999.9")
                BigDecimal carbGoal,
        @Schema(description = "Fat grams per day", example = "60.0")
                @NotNull
                @DecimalMin("0")
                @DecimalMax("9999.9")
                BigDecimal fatGoal) {}
