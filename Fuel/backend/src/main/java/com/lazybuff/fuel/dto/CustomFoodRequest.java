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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A custom food to create. The owner is always the caller; it cannot be sent in the body. */
@Getter
@Setter
@NoArgsConstructor
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
    @Setter(AccessLevel.NONE)
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
    @Setter(AccessLevel.NONE)
    private BigDecimal calories;

    @Schema(description = "Protein in grams per serving", example = "9.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal protein;

    @Schema(description = "Carbohydrates in grams per serving", example = "24.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal carbs;

    @Schema(description = "Fat in grams per serving", example = "5.0")
    @NotNull
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal fat;

    @Schema(
            description = "Fiber in grams per serving; defaults to 0",
            example = "4.0",
            nullable = true)
    @PositiveOrZero
    @Digits(integer = 5, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal fiber;

    public CustomFoodRequest(
            String name,
            String brand,
            BigDecimal servingSize,
            String servingUnit,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {
        this.name = name;
        this.brand = brand;
        this.servingUnit = servingUnit;
        setServingSize(servingSize);
        setCalories(calories);
        setProtein(protein);
        setCarbs(carbs);
        setFat(fat);
        setFiber(fiber);
    }

    public void setServingSize(BigDecimal servingSize) {
        this.servingSize = normalize(servingSize);
    }

    public void setCalories(BigDecimal calories) {
        this.calories = normalize(calories);
    }

    public void setProtein(BigDecimal protein) {
        this.protein = normalize(protein);
    }

    public void setCarbs(BigDecimal carbs) {
        this.carbs = normalize(carbs);
    }

    public void setFat(BigDecimal fat) {
        this.fat = normalize(fat);
    }

    public void setFiber(BigDecimal fiber) {
        this.fiber = normalize(fiber);
    }

    /**
     * Drops trailing zeros so 200.00 passes {@code @Digits}; Jackson keeps the JSON text's scale.
     */
    private static BigDecimal normalize(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal stripped = value.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }
}
