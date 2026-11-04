package com.lazybuff.fuel.service;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.BodyStatsRequest;
import com.lazybuff.fuel.dto.BodyStatsResponse;
import com.lazybuff.fuel.entity.BodyStats;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.BodyStatsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and saves the authenticated user's body stats. Health data: not annotated with
 * {@code @LogArguments}, and log lines carry the user id only.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class BodyStatsService {

    private static final BigDecimal CM_PER_FOOT = new BigDecimal("30.48");
    private static final BigDecimal KG_PER_POUND = new BigDecimal("0.45359237");
    private static final BigDecimal MIN_HEIGHT_CM = new BigDecimal("50.0");
    private static final BigDecimal MAX_HEIGHT_CM = new BigDecimal("300.0");
    private static final BigDecimal MIN_WEIGHT_KG = new BigDecimal("20.0");
    private static final BigDecimal MAX_WEIGHT_KG = new BigDecimal("300.0");

    private final BodyStatsRepository bodyStatsRepository;

    private final UserRepository userRepository;

    /**
     * @return the caller's stats, or a response with null data when none were saved yet
     * @throws FuelException 404 if the user no longer exists
     */
    @Transactional(readOnly = true)
    public ApiResponse<BodyStatsResponse> get(UUID userId) {

        findActiveUser(userId);

        BodyStatsResponse data =
                bodyStatsRepository.findByUser_Id(userId).map(this::toResponse).orElse(null);

        return success(data);
    }

    /**
     * Creates or replaces the caller's stats.
     *
     * @throws FuelException 404 if the user no longer exists; 400 if height or weight is out of
     *     range once converted to metric
     */
    @Transactional
    public ApiResponse<BodyStatsResponse> put(UUID userId, BodyStatsRequest request) {

        User user = findActiveUser(userId);

        BigDecimal heightCm = toCentimetres(request);
        BigDecimal weightKg = toKilograms(request);
        checkRange("Height", heightCm, MIN_HEIGHT_CM, MAX_HEIGHT_CM, "cm");
        checkRange("Weight", weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG, "kg");

        BodyStats stats =
                bodyStatsRepository
                        .findByUser_Id(userId)
                        .orElseGet(() -> BodyStats.builder().user(user).build());
        stats.setHeightCm(heightCm);
        stats.setWeightKg(weightKg);
        stats.setAge(request.getAge());
        stats.setGender(request.getGender());
        stats.setActivityLevel(request.getActivityLevel());

        BodyStats saved = bodyStatsRepository.save(stats);
        log.info("Body stats saved for user {}", userId);

        return success(toResponse(saved));
    }

    private BigDecimal toCentimetres(BodyStatsRequest request) {
        BigDecimal value =
                "ft".equals(request.getHeightUnit())
                        ? request.getHeight().multiply(CM_PER_FOOT)
                        : request.getHeight();
        return value.setScale(1, RoundingMode.HALF_UP);
    }

    private BigDecimal toKilograms(BodyStatsRequest request) {
        BigDecimal value =
                "lbs".equals(request.getWeightUnit())
                        ? request.getWeight().multiply(KG_PER_POUND)
                        : request.getWeight();
        return value.setScale(1, RoundingMode.HALF_UP);
    }

    private void checkRange(
            String name, BigDecimal value, BigDecimal min, BigDecimal max, String unit) {
        if (value.compareTo(min) < 0 || value.compareTo(max) > 0) {
            throw new FuelException(
                    HttpStatus.BAD_REQUEST,
                    name + " must be between " + min + " and " + max + " " + unit);
        }
    }

    private BodyStatsResponse toResponse(BodyStats stats) {
        return new BodyStatsResponse(
                stats.getHeightCm(),
                "cm",
                stats.getWeightKg(),
                "kg",
                stats.getAge(),
                stats.getGender(),
                stats.getActivityLevel(),
                stats.getUpdatedAt());
    }

    private ApiResponse<BodyStatsResponse> success(BodyStatsResponse data) {
        return ApiResponse.<BodyStatsResponse>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(
                        () -> {
                            log.warn("Request for missing user {}", userId);
                            return new FuelException(HttpStatus.NOT_FOUND, "User not found");
                        });
    }
}
