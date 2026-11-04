package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/** The user's daily goals. {@code updatedAt} is null when these are the defaults. */
@Schema(description = "Daily calorie and macro goals")
public record GoalsResponse(
        int calorieGoal,
        double proteinGoal,
        double carbGoal,
        double fatGoal,
        boolean isAutoCalculated,
        OffsetDateTime updatedAt) {}
