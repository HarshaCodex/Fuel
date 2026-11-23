package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.RecentFoodItem;
import com.lazybuff.fuel.repository.RecentFood;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lists the distinct foods a user logged most recently, so they can be logged again quickly. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class RecentFoodService {

    private final TrackingEntryRepository trackingEntryRepository;

    @Transactional(readOnly = true)
    public ApiResponse<List<RecentFoodItem>> recent(UUID userId, int limit) {

        try {
            List<RecentFoodItem> data =
                    trackingEntryRepository
                            .findRecentFoods(userId, PageRequest.of(0, limit))
                            .stream()
                            .map(RecentFoodService::toItem)
                            .toList();
            return ApiResponse.<List<RecentFoodItem>>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(data)
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (Exception exception) {
            log.error(
                    "Exception occurred while listing recent foods for user:{}", userId, exception);
            throw exception;
        }
    }

    private static RecentFoodItem toItem(RecentFood food) {
        return new RecentFoodItem(
                food.id(),
                food.name(),
                food.brand(),
                food.source() == null ? null : food.source().name(),
                food.servingSize(),
                food.servingUnit() == null
                        ? null
                        : food.servingUnit().name().toLowerCase(Locale.ROOT),
                food.calories(),
                food.protein(),
                food.carbs(),
                food.fat(),
                food.lastLoggedAt());
    }
}
