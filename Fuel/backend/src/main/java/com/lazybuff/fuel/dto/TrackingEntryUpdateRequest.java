package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Changes to an entry. A field left out (null) stays as it was; the food cannot change. */
@Getter
@Setter
@NoArgsConstructor
@ToString
@Schema(description = "Changes to a diary entry; omitted fields are left unchanged")
public class TrackingEntryUpdateRequest {

    @Schema(description = "New amount eaten, in the entry's unit", example = "200", nullable = true)
    @Positive
    @Digits(integer = 6, fraction = 1)
    @Setter(AccessLevel.NONE)
    private BigDecimal servingSize;

    @Schema(description = "New number of servings", example = "1.5", nullable = true)
    @Positive
    @Digits(integer = 3, fraction = 2)
    @Setter(AccessLevel.NONE)
    private BigDecimal quantity;

    @Schema(description = "New meal", example = "dinner", nullable = true)
    @Pattern(
            regexp = "breakfast|lunch|dinner|snack",
            message = "mealLabel must be one of breakfast, lunch, dinner, snack")
    private String mealLabel;

    @Schema(description = "New time it was eaten", nullable = true)
    private OffsetDateTime loggedAt;

    public void setServingSize(BigDecimal servingSize) {
        this.servingSize = TrackingEntryRequest.normalize(servingSize);
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = TrackingEntryRequest.normalize(quantity);
    }
}
