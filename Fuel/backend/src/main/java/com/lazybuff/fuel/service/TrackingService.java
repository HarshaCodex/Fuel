package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.config.TrackingConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.dto.TrackingEntryUpdateRequest;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
            checkNotTooFarAhead(loggedAt, now);

            Nutrients n =
                    scaleAll(
                            new Nutrients(
                                    food.getCalories(),
                                    food.getProtein(),
                                    food.getCarbs(),
                                    food.getFat(),
                                    food.getFiber()),
                            request.getServingSize().multiply(request.getQuantity()),
                            food.getServingSize());

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
                            .calories(n.calories())
                            .protein(n.protein())
                            .carbs(n.carbs())
                            .fat(n.fat())
                            .fiber(n.fiber())
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

    /** Rewrites the amount, quantity, meal or time of an entry the caller owns. */
    @Transactional
    public ApiResponse<TrackingEntryResponse> update(
            UUID userId, UUID entryId, TrackingEntryUpdateRequest request) {

        try {
            User user = findActiveUser(userId);
            TrackingEntry entry = findOwnedEntry(userId, entryId);

            if (request.getLoggedAt() != null) {
                checkNotTooFarAhead(request.getLoggedAt(), OffsetDateTime.now(ZoneOffset.UTC));
                entry.setLoggedAt(request.getLoggedAt());
                entry.setLogDate(logDate(user, userId, request.getLoggedAt()));
            }
            if (request.getMealLabel() != null) {
                entry.setMealLabel(request.getMealLabel());
            }
            if (request.getServingSize() != null || request.getQuantity() != null) {
                recompute(entry, request);
            }

            TrackingEntry saved = trackingEntryRepository.save(entry);
            return ApiResponse.<TrackingEntryResponse>builder()
                    .status(HttpStatus.OK.value())
                    .message("Entry updated")
                    .data(toResponse(saved))
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn(
                    "Entry update failed for user:{} entry:{} - {}",
                    userId,
                    entryId,
                    exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error(
                    "Exception occurred while updating entry:{} for user:{}",
                    entryId,
                    userId,
                    exception);
            throw exception;
        }
    }

    private void recompute(TrackingEntry entry, TrackingEntryUpdateRequest request) {
        BigDecimal size =
                request.getServingSize() != null
                        ? request.getServingSize()
                        : entry.getServingSize();
        BigDecimal quantity =
                request.getQuantity() != null ? request.getQuantity() : entry.getQuantity();

        // A soft-deleted custom food is hidden; its values live on in the entry's own snapshot.
        Nutrients base;
        BigDecimal baseSize;
        Optional<FoodItem> food = foodItemRepository.findById(entry.getFoodId());
        if (food.isPresent()) {
            FoodItem item = food.get();
            base =
                    new Nutrients(
                            item.getCalories(),
                            item.getProtein(),
                            item.getCarbs(),
                            item.getFat(),
                            item.getFiber());
            baseSize = item.getServingSize();
        } else {
            base =
                    new Nutrients(
                            entry.getCalories(),
                            entry.getProtein(),
                            entry.getCarbs(),
                            entry.getFat(),
                            entry.getFiber());
            baseSize = entry.getServingSize().multiply(entry.getQuantity());
        }

        Nutrients n = scaleAll(base, size.multiply(quantity), baseSize);
        entry.setServingSize(size);
        entry.setQuantity(quantity);
        entry.setCalories(n.calories());
        entry.setProtein(n.protein());
        entry.setCarbs(n.carbs());
        entry.setFat(n.fat());
        entry.setFiber(n.fiber());
    }

    private void checkNotTooFarAhead(OffsetDateTime loggedAt, OffsetDateTime now) {
        if (loggedAt.isAfter(now.plus(trackingConfig.getMaxFutureLog()))) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "loggedAt is too far in the future");
        }
    }

    private record Nutrients(
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {}

    /** Scales every nutrient to {@code factor} eaten against {@code baseSize}; rejects overflow. */
    private static Nutrients scaleAll(Nutrients base, BigDecimal factor, BigDecimal baseSize) {
        Nutrients n =
                new Nutrients(
                        scale(base.calories(), factor, baseSize, CALORIE_SCALE),
                        scale(base.protein(), factor, baseSize, MACRO_SCALE),
                        scale(base.carbs(), factor, baseSize, MACRO_SCALE),
                        scale(base.fat(), factor, baseSize, MACRO_SCALE),
                        scale(base.fiber(), factor, baseSize, MACRO_SCALE));
        if (n.calories().compareTo(MAX_CALORIES) > 0
                || n.protein().compareTo(MAX_MACRO) > 0
                || n.carbs().compareTo(MAX_MACRO) > 0
                || n.fat().compareTo(MAX_MACRO) > 0
                || n.fiber().compareTo(MAX_MACRO) > 0) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "Entry is too large");
        }
        return n;
    }

    /** value x amount eaten / base serving size; multiplies first to keep precision. */
    private static BigDecimal scale(
            BigDecimal value, BigDecimal factor, BigDecimal baseSize, int resultScale) {
        return value.multiply(factor)
                .divide(baseSize, MathContext.DECIMAL64)
                .setScale(resultScale, RoundingMode.HALF_UP);
    }

    /** Entries logged on {@code date} (the user's local date), oldest first; today if null. */
    @Transactional(readOnly = true)
    public ApiResponse<List<TrackingEntryResponse>> listByDate(UUID userId, LocalDate date) {

        try {
            User user = findActiveUser(userId);
            LocalDate day = date != null ? date : LocalDate.now(zoneOf(user, userId));
            List<TrackingEntryResponse> entries =
                    trackingEntryRepository
                            .findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(userId, day)
                            .stream()
                            .map(this::toResponse)
                            .toList();
            return ApiResponse.<List<TrackingEntryResponse>>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(entries)
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("Entry listing failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while listing entries for user:{}", userId, exception);
            throw exception;
        }
    }

    /** Soft-deletes the entry so it drops out of the diary but stays for later purging. */
    @Transactional
    public ApiResponse<Void> delete(UUID userId, UUID entryId) {

        try {
            findActiveUser(userId);
            TrackingEntry entry = findOwnedEntry(userId, entryId);
            entry.setDeletedAt(OffsetDateTime.now(ZoneOffset.UTC));

            trackingEntryRepository.save(entry);
            return ApiResponse.<Void>builder()
                    .status(HttpStatus.NO_CONTENT.value())
                    .message("Entry deleted")
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn(
                    "Entry deletion failed for user:{} entry:{} - {}",
                    userId,
                    entryId,
                    exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error(
                    "Exception occurred while deleting entry:{} for user:{}",
                    entryId,
                    userId,
                    exception);
            throw exception;
        }
    }

    private TrackingEntry findOwnedEntry(UUID userId, UUID entryId) {
        return trackingEntryRepository
                .findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "Entry not found"));
    }

    private ZoneId zoneOf(User user, UUID userId) {
        return UserZones.of(user, userId);
    }

    private LocalDate logDate(User user, UUID userId, OffsetDateTime loggedAt) {
        return loggedAt.atZoneSameInstant(zoneOf(user, userId)).toLocalDate();
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
