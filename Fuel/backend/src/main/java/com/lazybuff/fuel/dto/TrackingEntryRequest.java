package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A food to log. The owner is always the caller; it cannot be sent in the body. */
@Getter
@Setter
@NoArgsConstructor
@ToString
@Schema(description = "A food eaten, to add to the diary")
public class TrackingEntryRequest {

    private static final int MAX_EXPANDED_EXPONENT = 6;

    @Schema(description = "Id of the food being logged")
    @NotNull
    private UUID foodId;

    @Schema(description = "Amount eaten, in servingUnit", example = "150")
    @NotNull
    @Positive
    @Digits(integer = 6, fraction = 1)
    @Setter(AccessLevel.NONE)
    private BigDecimal servingSize;

    @Schema(
            description = "Unit of servingSize; must match the food's own serving unit",
            example = "g",
            allowableValues = {"g", "ml", "oz", "cup", "tbsp", "tsp", "piece", "serving"})
    @NotNull
    @Pattern(
            regexp = "g|ml|oz|cup|tbsp|tsp|piece|serving",
            message = "servingUnit must be one of g, ml, oz, cup, tbsp, tsp, piece, serving")
    private String servingUnit;

    @Schema(description = "Number of servings, decimals allowed", example = "1.5")
    @NotNull
    @Positive
    @Digits(integer = 3, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal quantity;

    @Schema(description = "Meal; null means uncategorised", example = "lunch", nullable = true)
    @Pattern(
            regexp = "breakfast|lunch|dinner|snack",
            message = "mealLabel must be one of breakfast, lunch, dinner, snack")
    private String mealLabel;

    @Schema(description = "When it was eaten; defaults to now", nullable = true)
    private OffsetDateTime loggedAt;

    public TrackingEntryRequest(
            UUID foodId,
            BigDecimal servingSize,
            String servingUnit,
            BigDecimal quantity,
            String mealLabel,
            OffsetDateTime loggedAt) {
        this.foodId = foodId;
        this.servingUnit = servingUnit;
        this.mealLabel = mealLabel;
        this.loggedAt = loggedAt;
        setServingSize(servingSize);
        setQuantity(quantity);
    }

    public void setServingSize(BigDecimal servingSize) {
        this.servingSize = normalize(servingSize);
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = normalize(quantity);
    }

    /**
     * Drops trailing zeros so 150.0 passes {@code @Digits}; Jackson keeps the JSON text's scale.
     */
    private static BigDecimal normalize(BigDecimal value) {
        if (value == null) {
            return null;
        }
        BigDecimal stripped = value.stripTrailingZeros();
        // Expanding a huge exponent (1e999999999) would exhaust memory; @Digits rejects it cheaply.
        return stripped.scale() < 0 && stripped.scale() >= -MAX_EXPANDED_EXPONENT
                ? stripped.setScale(0)
                : stripped;
    }
}
