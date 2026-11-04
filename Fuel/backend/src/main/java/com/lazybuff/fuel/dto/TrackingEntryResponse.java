package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** A logged entry as returned by the API, with the nutrients computed for what was eaten. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@Schema(description = "A logged food entry")
public class TrackingEntryResponse {

    private UUID id;
    private UUID foodId;
    private String foodName;

    @Schema(
            example = "USDA",
            allowableValues = {"USDA", "OFF", "USER"})
    private String source;

    private BigDecimal servingSize;

    @Schema(example = "g")
    private String servingUnit;

    private BigDecimal quantity;

    @Schema(example = "lunch", nullable = true)
    private String mealLabel;

    private OffsetDateTime loggedAt;
    private BigDecimal calories;
    private BigDecimal protein;
    private BigDecimal carbs;
    private BigDecimal fat;
    private BigDecimal fiber;
    private OffsetDateTime createdAt;
}
