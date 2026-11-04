package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and saves the authenticated user's daily goals. Arguments are numeric only. */
@Service
@Slf4j
@RequiredArgsConstructor
@LogArguments
public class GoalsService {

    /** Match the column defaults of {@code user_goals}. */
    static final int DEFAULT_CALORIE_GOAL = 2000;

    static final double DEFAULT_PROTEIN_GOAL = 50.0;
    static final double DEFAULT_CARB_GOAL = 250.0;
    static final double DEFAULT_FAT_GOAL = 65.0;

    private static final int MACRO_SCALE = 1;

    private final UserGoalsRepository userGoalsRepository;

    private final UserRepository userRepository;

    /**
     * Cross-module read (e.g. the dashboard). Does not check the user exists.
     *
     * @return the stored goals, or the defaults when none were saved; never creates a row
     */
    @Transactional(readOnly = true)
    public GoalsResponse getGoals(UUID userId) {

        return userGoalsRepository
                .findByUser_Id(userId)
                .map(this::toResponse)
                .orElseGet(this::defaults);
    }

    /**
     * @throws FuelException 404 if the user no longer exists
     */
    @Transactional(readOnly = true)
    public ApiResponse<GoalsResponse> get(UUID userId) {

        findActiveUser(userId);

        return success(getGoals(userId));
    }

    /**
     * Creates or replaces the caller's goals and marks them as manually set.
     *
     * @throws FuelException 404 if the user no longer exists
     */
    @Transactional
    public ApiResponse<GoalsResponse> put(UUID userId, GoalsRequest request) {

        User user = findActiveUser(userId);

        UserGoals goals =
                userGoalsRepository
                        .findByUser_Id(userId)
                        .orElseGet(() -> UserGoals.builder().user(user).build());
        goals.setCalorieGoal(request.calorieGoal());
        goals.setProteinGoal(round(request.proteinGoal()));
        goals.setCarbGoal(round(request.carbGoal()));
        goals.setFatGoal(round(request.fatGoal()));
        goals.setAutoCalculated(false);

        // Set explicitly so an identical PUT still bumps the timestamp; flush so it is populated.
        goals.setUpdatedAt(OffsetDateTime.now());
        UserGoals saved = userGoalsRepository.saveAndFlush(goals);
        log.info("Goals saved for user {}", userId);

        return success(toResponse(saved));
    }

    private double round(BigDecimal value) {
        return value.setScale(MACRO_SCALE, RoundingMode.HALF_UP).doubleValue();
    }

    private GoalsResponse defaults() {
        return new GoalsResponse(
                DEFAULT_CALORIE_GOAL,
                DEFAULT_PROTEIN_GOAL,
                DEFAULT_CARB_GOAL,
                DEFAULT_FAT_GOAL,
                false,
                null);
    }

    private GoalsResponse toResponse(UserGoals goals) {
        return new GoalsResponse(
                goals.getCalorieGoal(),
                goals.getProteinGoal(),
                goals.getCarbGoal(),
                goals.getFatGoal(),
                goals.isAutoCalculated(),
                goals.getUpdatedAt());
    }

    private ApiResponse<GoalsResponse> success(GoalsResponse data) {
        return ApiResponse.<GoalsResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
