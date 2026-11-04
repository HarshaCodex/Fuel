package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The caller's body stats, always in metric units. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Saved body stats, always metric")
public class BodyStatsResponse {

    @Schema(example = "175.0")
    private BigDecimal height;

    @Schema(example = "cm")
    private String heightUnit;

    @Schema(example = "72.5")
    private BigDecimal weight;

    @Schema(example = "kg")
    private String weightUnit;

    @Schema(example = "25")
    private int age;

    @Schema(example = "MALE")
    private String gender;

    @Schema(example = "MODERATE")
    private String activityLevel;

    @Schema(description = "When the stats were last saved")
    private OffsetDateTime updatedAt;

    /** Health data: deliberately no values in toString so it can't reach logs. */
    @Override
    public String toString() {
        return "BodyStatsResponse";
    }
}
