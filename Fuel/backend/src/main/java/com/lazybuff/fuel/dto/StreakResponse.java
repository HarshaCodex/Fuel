package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/** Logging streak as of today in the user's timezone. */
public record StreakResponse(
        @Schema(description = "Consecutive logged days ending today or yesterday", example = "5")
                int current,
        @Schema(description = "Longest run of consecutive logged days", example = "12") int longest,
        @Schema(
                        description = "Most recent logged date, null when nothing is logged",
                        example = "2026-11-04",
                        nullable = true)
                LocalDate lastLoggedDate) {}
