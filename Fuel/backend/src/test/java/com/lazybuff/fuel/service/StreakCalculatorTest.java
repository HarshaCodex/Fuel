package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.StreakResponse;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("StreakCalculator")
class StreakCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 5);

    private static LocalDate ago(int days) {
        return TODAY.minusDays(days);
    }

    @Test
    @DisplayName("returns zeros and no date when nothing is logged")
    void shouldReturnZerosWhenEmpty() {
        assertThat(StreakCalculator.compute(List.of(), TODAY))
                .isEqualTo(new StreakResponse(0, 0, null));
    }

    @Test
    @DisplayName("counts one day when only today is logged")
    void shouldCountTodayOnly() {
        assertThat(StreakCalculator.compute(List.of(TODAY), TODAY))
                .isEqualTo(new StreakResponse(1, 1, TODAY));
    }

    @Test
    @DisplayName("counts today and yesterday as two")
    void shouldCountTodayAndYesterday() {
        assertThat(StreakCalculator.compute(List.of(TODAY, ago(1)), TODAY))
                .isEqualTo(new StreakResponse(2, 2, TODAY));
    }

    @Test
    @DisplayName("keeps the streak alive when today is not logged yet")
    void shouldSurviveNotYetLoggedToday() {
        assertThat(StreakCalculator.compute(List.of(ago(1), ago(2), ago(3)), TODAY))
                .isEqualTo(new StreakResponse(3, 3, ago(1)));
    }

    @Test
    @DisplayName("resets current to zero after a missed day but keeps longest")
    void shouldResetCurrentAfterMissedDay() {
        assertThat(StreakCalculator.compute(List.of(ago(2), ago(3), ago(4)), TODAY))
                .isEqualTo(new StreakResponse(0, 3, ago(2)));
    }

    @Test
    @DisplayName("takes longest from an earlier run across a gap")
    void shouldTakeLongestFromEarlierRun() {
        assertThat(
                        StreakCalculator.compute(
                                List.of(TODAY, ago(1), ago(4), ago(5), ago(6), ago(7)), TODAY))
                .isEqualTo(new StreakResponse(2, 4, TODAY));
    }

    @Test
    @DisplayName("counts only the newest run as current when several runs exist")
    void shouldCountOnlyNewestRunAsCurrent() {
        assertThat(
                        StreakCalculator.compute(
                                List.of(TODAY, ago(2), ago(3), ago(5), ago(6), ago(7)), TODAY))
                .isEqualTo(new StreakResponse(1, 3, TODAY));
    }

    @Test
    @DisplayName("treats isolated days as runs of one")
    void shouldTreatIsolatedDaysAsSingleRuns() {
        assertThat(StreakCalculator.compute(List.of(TODAY, ago(2), ago(4)), TODAY))
                .isEqualTo(new StreakResponse(1, 1, TODAY));
    }

    @Test
    @DisplayName("continues a run across 29 February in a leap year")
    void shouldContinueAcrossLeapDay() {
        LocalDate today = LocalDate.of(2028, 3, 1);
        List<LocalDate> dates =
                List.of(today, LocalDate.of(2028, 2, 29), LocalDate.of(2028, 2, 28));

        assertThat(StreakCalculator.compute(dates, today))
                .isEqualTo(new StreakResponse(3, 3, today));
    }

    @Test
    @DisplayName("continues a run across the year end")
    void shouldContinueAcrossYearEnd() {
        LocalDate today = LocalDate.of(2027, 1, 1);
        List<LocalDate> dates =
                List.of(today, LocalDate.of(2026, 12, 31), LocalDate.of(2026, 12, 30));

        assertThat(StreakCalculator.compute(dates, today))
                .isEqualTo(new StreakResponse(3, 3, today));
    }
}
