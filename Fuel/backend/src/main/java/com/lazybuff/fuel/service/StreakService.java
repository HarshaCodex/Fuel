package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.StreakResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Computes how many consecutive days a user has logged food. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class StreakService {

    private final TrackingEntryRepository trackingEntryRepository;

    private final UserRepository userRepository;

    private final Clock clock;

    @Transactional(readOnly = true)
    public ApiResponse<StreakResponse> get(UUID userId) {

        try {
            User user = findActiveUser(userId);
            return ApiResponse.<StreakResponse>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(streakFor(user))
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("Streak lookup failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while computing streak for user:{}", userId, exception);
            throw exception;
        }
    }

    /** Streak as of today in the user's timezone; shared with the dashboard. */
    StreakResponse streakFor(User user) {
        LocalDate today = LocalDate.now(clock.withZone(UserZones.of(user, user.getId())));
        return StreakCalculator.compute(
                trackingEntryRepository.findDistinctLogDates(user.getId(), today), today);
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
