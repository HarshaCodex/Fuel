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

/** A custom food as returned by the API. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
@Schema(description = "A custom food")
public class CustomFoodResponse {

    private UUID id;
    private String name;
    private String brand;

    @Schema(example = "USER")
    private String source;

    private String sourceId;
    private BigDecimal servingSize;

    @Schema(example = "g")
    private String servingUnit;

    private BigDecimal calories;
    private BigDecimal protein;
    private BigDecimal carbs;
    private BigDecimal fat;
    private BigDecimal fiber;

    @Schema(description = "Id of the user who created the food")
    private UUID createdBy;

    private OffsetDateTime createdAt;
}
