package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A custom food to create. The owner is always the caller; it cannot be sent in the body. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Schema(description = "Custom food with nutrients for one serving")
public class CustomFoodRequest {

    @Schema(description = "Food name", example = "Mom's Dal Tadka")
    @NotBlank
    @Size(max = 200)
    private String name;

    @Schema(description = "Brand, optional", example = "Home made", nullable = true)
    @Size(max = 200)
    private String brand;

    @Schema(description = "Serving size in servingUnit", example = "200")
    @NotNull
    @Positive
    @Digits(integer = 6, fraction = 1)
    private BigDecimal servingSize;

    @Schema(
            description = "Unit of the serving",
            example = "g",
            allowableValues = {"g", "ml", "oz", "cup", "tbsp", "tsp", "piece", "serving"})
    @NotNull
    @Pattern(
            regexp = "g|ml|oz|cup|tbsp|tsp|piece|serving",
            message = "servingUnit must be one of g, ml, oz, cup, tbsp, tsp, piece, serving")
    private String servingUnit;

    @Schema(description = "Calories per serving", example = "180")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 6, fraction = 1)
    private BigDecimal calories;

    @Schema(description = "Protein in grams per serving", example = "9.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    private BigDecimal protein;

    @Schema(description = "Carbohydrates in grams per serving", example = "24.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    private BigDecimal carbs;

    @Schema(description = "Fat in grams per serving", example = "5.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    private BigDecimal fat;

    @Schema(
            description = "Fiber in grams per serving; defaults to 0",
            example = "4.0",
            nullable = true)
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    private BigDecimal fiber;
}
