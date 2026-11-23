package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.HistoryDayResponse;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.DailyTotals;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Per-day nutrient totals over a bounded date range. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class HistoryService {

    /** Inclusive of both ends. */
    static final int MAX_RANGE_DAYS = 90;

    private final TrackingEntryRepository trackingEntryRepository;

    private final UserRepository userRepository;

    private final GoalsService goalsService;

    /** One row per day with entries, newest first. Days without entries are omitted. */
    @Transactional(readOnly = true)
    public ApiResponse<List<HistoryDayResponse>> get(UUID userId, LocalDate from, LocalDate to) {

        try {
            validateRange(from, to);
            findActiveUser(userId);
            int calorieGoal = goalsService.getGoals(userId).calorieGoal();

            List<HistoryDayResponse> days =
                    trackingEntryRepository.findDailyTotals(userId, from, to).stream()
                            .map(totals -> toResponse(totals, calorieGoal))
                            .toList();

            return ApiResponse.<List<HistoryDayResponse>>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(days)
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("History failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while building history for user:{}", userId, exception);
            throw exception;
        }
    }

    private static void validateRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "'to' must not be before 'from'");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_RANGE_DAYS) {
            throw new FuelException(
                    HttpStatus.BAD_REQUEST,
                    "Date range must not exceed " + MAX_RANGE_DAYS + " days");
        }
    }

    private static HistoryDayResponse toResponse(DailyTotals totals, int calorieGoal) {
        return new HistoryDayResponse(
                totals.logDate(),
                totals.calories(),
                calorieGoal,
                totals.protein(),
                totals.carbs(),
                totals.fat(),
                totals.fiber(),
                totals.entryCount().intValue());
    }

    private void findActiveUser(UUID userId) {
        userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
