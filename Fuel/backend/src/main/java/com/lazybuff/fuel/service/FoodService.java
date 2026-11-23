package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.FoodItemToFoodItemDetailMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class FoodService {

    private final FoodItemRepository foodItemRepository;

    private final FoodItemToFoodItemDetailMapper foodItemDetailMapper;

    /**
     * A shared food, or one of the caller's own custom foods. Another user's custom food is a 404,
     * so its id can't be used to tell whether it exists.
     */
    @Transactional(readOnly = true)
    public ApiResponse<FoodItemDetail> getFoodById(UUID id, UUID userId) {

        try {
            FoodItem foodItem =
                    foodItemRepository
                            .findViewableWithServingSizesById(id, userId)
                            .orElseThrow(
                                    () ->
                                            new FuelException(
                                                    HttpStatus.NOT_FOUND, "Food item not found"));

            return ApiResponse.<FoodItemDetail>builder()
                    .status(HttpStatus.OK.value())
                    .message("Success")
                    .data(foodItemDetailMapper.foodItemToFoodItemDetail(foodItem))
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (FuelException exception) {
            log.warn("Food item lookup failed for id:{} - {}", id, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error("Exception occurred while fetching food item for id:{}", id, exception);
            throw exception;
        }
    }
}
