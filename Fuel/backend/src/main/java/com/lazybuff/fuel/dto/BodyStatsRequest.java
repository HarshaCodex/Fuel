package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Body stats to save. Height and weight may be sent in imperial units; they are stored metric. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Body measurements; every field is required")
public class BodyStatsRequest {

    @Schema(description = "Height in heightUnit (decimal feet when ft)", example = "175")
    @NotNull
    @Positive
    @DecimalMax("1000")
    private BigDecimal height;

    @Schema(
            description = "Unit of height",
            example = "cm",
            allowableValues = {"cm", "ft"})
    @NotNull
    @Pattern(regexp = "cm|ft", message = "heightUnit must be cm or ft")
    private String heightUnit;

    @Schema(description = "Weight in weightUnit", example = "72.5")
    @NotNull
    @Positive
    @DecimalMax("2000")
    private BigDecimal weight;

    @Schema(
            description = "Unit of weight",
            example = "kg",
            allowableValues = {"kg", "lbs"})
    @NotNull
    @Pattern(regexp = "kg|lbs", message = "weightUnit must be kg or lbs")
    private String weightUnit;

    @Schema(description = "Age in years, 13 to 120", example = "25")
    @NotNull
    @Min(13)
    @Max(120)
    private Integer age;

    @Schema(
            description = "Gender",
            example = "MALE",
            allowableValues = {"MALE", "FEMALE"})
    @NotNull
    @Pattern(regexp = "MALE|FEMALE", message = "gender must be MALE or FEMALE")
    private String gender;

    @Schema(
            description = "Activity level",
            example = "MODERATE",
            allowableValues = {"SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"})
    @NotNull
    @Pattern(
            regexp = "SEDENTARY|LIGHT|MODERATE|ACTIVE|VERY_ACTIVE",
            message = "activityLevel must be SEDENTARY, LIGHT, MODERATE, ACTIVE or VERY_ACTIVE")
    private String activityLevel;

    /** Health data: deliberately no values in toString so it can't reach logs. */
    @Override
    public String toString() {
        return "BodyStatsRequest";
    }
}
