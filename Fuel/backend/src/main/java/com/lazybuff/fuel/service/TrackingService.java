package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.config.TrackingConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.TrackingEntry;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Logs foods to a user's diary. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class TrackingService {

    private static final BigDecimal MAX_CALORIES = new BigDecimal("999999.9");
    private static final BigDecimal MAX_MACRO = new BigDecimal("99999.99");
    private static final int CALORIE_SCALE = 1;
    private static final int MACRO_SCALE = 2;

    private final FoodItemRepository foodItemRepository;

    private final TrackingEntryRepository trackingEntryRepository;

    private final UserRepository userRepository;

    private final TrackingConfig trackingConfig;

    @Transactional
    public ApiResponse<TrackingEntryResponse> create(UUID userId, TrackingEntryRequest request) {

        try {
            User user = findActiveUser(userId);
            FoodItem food =
                    foodItemRepository
                            .findLoggableById(request.getFoodId(), userId)
                            .orElseThrow(
                                    () ->
                                            new FuelException(
                                                    HttpStatus.NOT_FOUND, "Food item not found"));

            ServingUnit unit =
                    ServingUnit.valueOf(request.getServingUnit().toUpperCase(Locale.ROOT));
            if (unit != food.getServingUnit()) {
                throw new FuelException(
                        HttpStatus.BAD_REQUEST, "servingUnit must match the food's serving unit");
            }

            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            OffsetDateTime loggedAt = request.getLoggedAt() != null ? request.getLoggedAt() : now;
            if (loggedAt.isAfter(now.plus(trackingConfig.getMaxFutureLog()))) {
                throw new FuelException(
                        HttpStatus.BAD_REQUEST, "loggedAt is too far in the future");
            }

            BigDecimal factor = request.getServingSize().multiply(request.getQuantity());
            BigDecimal calories = scale(food.getCalories(), factor, food, CALORIE_SCALE);
            BigDecimal protein = scale(food.getProtein(), factor, food, MACRO_SCALE);
            BigDecimal carbs = scale(food.getCarbs(), factor, food, MACRO_SCALE);
            BigDecimal fat = scale(food.getFat(), factor, food, MACRO_SCALE);
            BigDecimal fiber = scale(food.getFiber(), factor, food, MACRO_SCALE);
            if (calories.compareTo(MAX_CALORIES) > 0
                    || protein.compareTo(MAX_MACRO) > 0
                    || carbs.compareTo(MAX_MACRO) > 0
                    || fat.compareTo(MAX_MACRO) > 0
                    || fiber.compareTo(MAX_MACRO) > 0) {
                throw new FuelException(HttpStatus.BAD_REQUEST, "Entry is too large");
            }

            TrackingEntry entry =
                    TrackingEntry.builder()
                            .user(user)
                            .foodId(food.getId())
                            .foodName(food.getName())
                            .foodSource(food.getSource())
                            .servingSize(request.getServingSize())
                            .servingUnit(unit)
                            .quantity(request.getQuantity())
                            .mealLabel(request.getMealLabel())
                            .loggedAt(loggedAt)
                            .logDate(logDate(user, userId, loggedAt))
                            .calories(calories)
                            .protein(protein)
                            .carbs(carbs)
                            .fat(fat)
                            .fiber(fiber)
                            .build();

            TrackingEntry saved = trackingEntryRepository.save(entry);
            return ApiResponse.<TrackingEntryResponse>builder()
                    .status(HttpStatus.CREATED.value())
                    .message("Entry logged")
                    .data(toResponse(saved))
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("Entry logging failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while logging entry for user:{}", userId, exception);
            throw exception;
        }
    }

    /** value x amount eaten / food's serving size; multiplies first to keep precision. */
    private static BigDecimal scale(
            BigDecimal value, BigDecimal factor, FoodItem food, int resultScale) {
        return value.multiply(factor)
                .divide(food.getServingSize(), MathContext.DECIMAL64)
                .setScale(resultScale, RoundingMode.HALF_UP);
    }

    private LocalDate logDate(User user, UUID userId, OffsetDateTime loggedAt) {
        ZoneId zone;
        try {
            zone = ZoneId.of(user.getTimezone());
        } catch (DateTimeException exception) {
            // Registration does not validate IANA ids; the timezone itself is not logged.
            log.warn("User:{} has an invalid timezone, using UTC", userId);
            zone = ZoneOffset.UTC;
        }
        return loggedAt.atZoneSameInstant(zone).toLocalDate();
    }

    private TrackingEntryResponse toResponse(TrackingEntry entry) {
        return TrackingEntryResponse.builder()
                .id(entry.getId())
                .foodId(entry.getFoodId())
                .foodName(entry.getFoodName())
                .source(entry.getFoodSource().name())
                .servingSize(entry.getServingSize())
                .servingUnit(entry.getServingUnit().name().toLowerCase(Locale.ROOT))
                .quantity(entry.getQuantity())
                .mealLabel(entry.getMealLabel())
                .loggedAt(entry.getLoggedAt())
                .calories(entry.getCalories())
                .protein(entry.getProtein())
                .carbs(entry.getCarbs())
                .fat(entry.getFat())
                .fiber(entry.getFiber())
                .createdAt(entry.getCreatedAt())
                .build();
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }
}
