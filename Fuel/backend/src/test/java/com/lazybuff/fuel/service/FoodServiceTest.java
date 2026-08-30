package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.FoodItemToFoodItemDetailMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("FoodService")
class FoodServiceTest {

    @Mock private FoodItemRepository foodItemRepository;
    @Mock private FoodItemToFoodItemDetailMapper foodItemDetailMapper;

    private FoodService foodService;

    private FoodItem persistedFoodItem;
    private FoodItemDetail foodItemDetail;

    @BeforeEach
    void setUp() {
        foodService = new FoodService(foodItemRepository, foodItemDetailMapper);
        persistedFoodItem = TestDataFactory.persistedFoodItem();
        foodItemDetail = TestDataFactory.foodItemDetail();
    }

    @Nested
    @DisplayName("getFoodById - found")
    class FoodFound {

        @BeforeEach
        void stubHit() {
            when(foodItemRepository.findWithServingSizesById(TestDataFactory.FOOD_ID))
                    .thenReturn(Optional.of(persistedFoodItem));
            when(foodItemDetailMapper.foodItemToFoodItemDetail(persistedFoodItem))
                    .thenReturn(foodItemDetail);
        }

        @Test
        @DisplayName("returns a 200 response carrying the mapped food item")
        void returnsOkResponse() {
            ApiResponse<FoodItemDetail> response = foodService.getFoodById(TestDataFactory.FOOD_ID);

            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo("Success");
            assertThat(response.getTimestamp()).isNotNull();
            assertThat(response.getData()).isSameAs(foodItemDetail);
        }

        @Test
        @DisplayName("fetches through the serving-sizes entity graph, not a plain findById")
        void usesEntityGraphQuery() {
            foodService.getFoodById(TestDataFactory.FOOD_ID);

            verify(foodItemRepository).findWithServingSizesById(TestDataFactory.FOOD_ID);
        }
    }

    @Nested
    @DisplayName("getFoodById - not found")
    class FoodNotFound {

        @Test
        @DisplayName("throws a 404 FuelException when no food item matches the id")
        void throwsNotFound() {
            UUID missingId = UUID.randomUUID();
            when(foodItemRepository.findWithServingSizesById(missingId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> foodService.getFoodById(missingId))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Food item not found")
                    .extracting(exception -> ((FuelException) exception).getHttpStatus())
                    .isEqualTo(HttpStatus.NOT_FOUND);
        }

        @Test
        @DisplayName("never invokes the mapper")
        void doesNotMap() {
            UUID missingId = UUID.randomUUID();
            when(foodItemRepository.findWithServingSizesById(missingId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> foodService.getFoodById(missingId))
                    .isInstanceOf(FuelException.class);

            verifyNoInteractions(foodItemDetailMapper);
        }
    }

    @Nested
    @DisplayName("getFoodById - unexpected failures")
    class UnexpectedFailure {

        @Test
        @DisplayName("propagates a repository failure instead of swallowing it")
        void propagatesRepositoryFailure() {
            when(foodItemRepository.findWithServingSizesById(TestDataFactory.FOOD_ID))
                    .thenThrow(new IllegalStateException("connection reset"));

            assertThatThrownBy(() -> foodService.getFoodById(TestDataFactory.FOOD_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("connection reset");
        }

        @Test
        @DisplayName("propagates a mapping failure instead of swallowing it")
        void propagatesMappingFailure() {
            when(foodItemRepository.findWithServingSizesById(TestDataFactory.FOOD_ID))
                    .thenReturn(Optional.of(persistedFoodItem));
            when(foodItemDetailMapper.foodItemToFoodItemDetail(any(FoodItem.class)))
                    .thenThrow(new IllegalArgumentException("bad serving size"));

            assertThatThrownBy(() -> foodService.getFoodById(TestDataFactory.FOOD_ID))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("bad serving size");
        }
    }
}
