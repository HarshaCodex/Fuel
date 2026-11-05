package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DashboardResponse;
import com.lazybuff.fuel.dto.DashboardResponse.Calories;
import com.lazybuff.fuel.dto.DashboardResponse.DashboardEntry;
import com.lazybuff.fuel.dto.DashboardResponse.Macro;
import com.lazybuff.fuel.dto.DashboardResponse.Macros;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.entity.TrackingEntry;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Builds the daily dashboard: totals, goals, entries and streak. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class DashboardService {

    private static final String MACRO_UNIT = "g";

    private final TrackingEntryRepository trackingEntryRepository;

    private final UserRepository userRepository;

    private final GoalsService goalsService;

    private final StreakService streakService;

    private final Clock clock;

    /** The date defaults to today in the user's profile timezone. */
    @Transactional(readOnly = true)
    public ApiResponse<DashboardResponse> get(UUID userId, LocalDate date) {

        try {
            User user = findActiveUser(userId);
            LocalDate day =
                    date != null ? date : LocalDate.now(clock.withZone(UserZones.of(user, userId)));
            List<TrackingEntry> entries =
                    trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                            userId, day);
            GoalsResponse goals = goalsService.getGoals(userId);

            BigDecimal calories = sum(entries, TrackingEntry::getCalories);
            DashboardResponse body =
                    new DashboardResponse(
                            day,
                            new Calories(
                                    calories,
                                    goals.calorieGoal(),
                                    BigDecimal.valueOf(goals.calorieGoal()).subtract(calories)),
                            new Macros(
                                    macro(
                                            sum(entries, TrackingEntry::getProtein),
                                            goals.proteinGoal()),
                                    macro(sum(entries, TrackingEntry::getCarbs), goals.carbGoal()),
                                    macro(sum(entries, TrackingEntry::getFat), goals.fatGoal())),
                            entries.stream().map(DashboardService::toEntry).toList(),
                            streakService.streakFor(user));

            return ApiResponse.<DashboardResponse>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(body)
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("Dashboard failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while building dashboard for user:{}", userId, exception);
            throw exception;
        }
    }

    private static BigDecimal sum(
            List<TrackingEntry> entries, Function<TrackingEntry, BigDecimal> value) {
        return entries.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Macro macro(BigDecimal consumed, double goal) {
        return new Macro(consumed, goal, MACRO_UNIT);
    }

    private static DashboardEntry toEntry(TrackingEntry entry) {
        return new DashboardEntry(
                entry.getId(),
                entry.getFoodName(),
                entry.getFoodSource().name(),
                entry.getMealLabel(),
                entry.getCalories(),
                entry.getProtein(),
                entry.getCarbs(),
                entry.getFat(),
                entry.getLoggedAt());
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
