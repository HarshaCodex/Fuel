package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.dto.PageResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.CustomFoodMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.FoodSource;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates and lists the foods a user defined themselves. */
@Service
@RequiredArgsConstructor
@Slf4j
@LogArguments
public class CustomFoodService {

    private final FoodItemRepository foodItemRepository;

    private final UserRepository userRepository;

    private final CustomFoodMapper customFoodMapper;

    @Transactional
    public ApiResponse<CustomFoodResponse> create(UUID userId, CustomFoodRequest request) {

        try {
            User user = findActiveUser(userId);
            FoodItem foodItem = customFoodMapper.toEntity(request);
            foodItem.setUser(user);

            FoodItem saved = foodItemRepository.save(foodItem);
            return response(
                    HttpStatus.CREATED, "Custom food created", customFoodMapper.toResponse(saved));
        } catch (FuelException exception) {
            log.warn(
                    "Custom food creation failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error(
                    "Exception occurred while creating custom food for user:{}", userId, exception);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public ApiResponse<PageResponse<CustomFoodResponse>> list(UUID userId, int page, int size) {

        try {
            findActiveUser(userId);

            Page<FoodItem> result =
                    foodItemRepository.findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(
                            FoodSource.USER, userId, PageRequest.of(page, size));

            PageResponse<CustomFoodResponse> data =
                    PageResponse.<CustomFoodResponse>builder()
                            .content(
                                    result.getContent().stream()
                                            .map(customFoodMapper::toResponse)
                                            .toList())
                            .page(result.getNumber())
                            .size(result.getSize())
                            .totalElements(result.getTotalElements())
                            .totalPages(result.getTotalPages())
                            .build();
            return response(HttpStatus.OK, "Success", data);
        } catch (FuelException exception) {
            log.warn("Custom food listing failed for user:{} - {}", userId, exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            log.error(
                    "Exception occurred while listing custom foods for user:{}", userId, exception);
            throw exception;
        }
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> new FuelException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private <T> ApiResponse<T> response(HttpStatus status, String message, T data) {
        return ApiResponse.<T>builder()
                .status(status.value())
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
