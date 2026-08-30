package com.lazybuff.fuel.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.dto.ServingSizeData;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.FoodServingSize;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mapstruct.factory.Mappers;

@DisplayName("FoodItemToFoodItemDetailMapper")
class FoodItemToFoodItemDetailMapperTest {

    private static final UUID FOOD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final OffsetDateTime CREATED_AT =
            OffsetDateTime.of(2026, 1, 2, 3, 4, 5, 0, ZoneOffset.UTC);
    private static final OffsetDateTime UPDATED_AT = CREATED_AT.plusDays(1);

    private final FoodItemToFoodItemDetailMapper mapper =
            Mappers.getMapper(FoodItemToFoodItemDetailMapper.class);

    private FoodItem foodItem;

    @BeforeEach
    void setUp() {
        foodItem = foodItem(ServingUnit.G);
    }

    private static FoodItem foodItem(ServingUnit servingUnit) {
        FoodItem item =
                FoodItem.builder()
                        .id(FOOD_ID)
                        .name("Rolled Oats")
                        .brand("Quaker")
                        .source(FoodSource.USDA)
                        .sourceId("173904")
                        .barcode("0123456789012")
                        .servingSize(new BigDecimal("40.0"))
                        .servingUnit(servingUnit)
                        .calories(new BigDecimal("150.0"))
                        .protein(new BigDecimal("5.00"))
                        .carbs(new BigDecimal("27.00"))
                        .fat(new BigDecimal("3.00"))
                        .fiber(new BigDecimal("4.00"))
                        .createdAt(CREATED_AT)
                        .updatedAt(UPDATED_AT)
                        .build();

        item.getServingSizes()
                .addAll(
                        List.of(
                                servingSize(item, "1 cup", new BigDecimal("81.0")),
                                servingSize(item, "1 packet", new BigDecimal("28.0"))));
        return item;
    }

    private static FoodServingSize servingSize(FoodItem item, String label, BigDecimal grams) {
        return FoodServingSize.builder()
                .id(UUID.randomUUID())
                .foodItem(item)
                .label(label)
                .quantityInGrams(grams)
                .build();
    }

    @Nested
    @DisplayName("scalar fields")
    class ScalarFields {

        @Test
        @DisplayName("carries the entity id straight through as a UUID")
        void mapsId() {
            assertThat(mapper.foodItemToFoodItemDetail(foodItem).getId()).isEqualTo(FOOD_ID);
        }

        @Test
        @DisplayName("maps every descriptive and nutritional field")
        void mapsRemainingFields() {
            FoodItemDetail detail = mapper.foodItemToFoodItemDetail(foodItem);

            assertThat(detail.getName()).isEqualTo("Rolled Oats");
            assertThat(detail.getBrand()).isEqualTo("Quaker");
            assertThat(detail.getSourceId()).isEqualTo("173904");
            assertThat(detail.getBarcode()).isEqualTo("0123456789012");
            assertThat(detail.getServingSize()).isEqualByComparingTo("40.0");
            assertThat(detail.getCalories()).isEqualByComparingTo("150.0");
            assertThat(detail.getProtein()).isEqualByComparingTo("5.00");
            assertThat(detail.getCarbs()).isEqualByComparingTo("27.00");
            assertThat(detail.getFat()).isEqualByComparingTo("3.00");
            assertThat(detail.getFiber()).isEqualByComparingTo("4.00");
            assertThat(detail.getCreatedAt()).isEqualTo(CREATED_AT);
            assertThat(detail.getUpdatedAt()).isEqualTo(UPDATED_AT);
        }

        @Test
        @DisplayName("exposes the source enum by its uppercase name")
        void mapsSource() {
            assertThat(mapper.foodItemToFoodItemDetail(foodItem).getSource()).isEqualTo("USDA");
        }

        @ParameterizedTest
        @EnumSource(ServingUnit.class)
        @DisplayName("exposes the serving unit lowercased, matching what the column stores")
        void lowercasesServingUnit(ServingUnit servingUnit) {
            FoodItemDetail detail = mapper.foodItemToFoodItemDetail(foodItem(servingUnit));

            assertThat(detail.getServingUnit()).isEqualTo(servingUnit.name().toLowerCase());
        }
    }

    @Nested
    @DisplayName("serving sizes")
    class ServingSizes {

        @Test
        @DisplayName("populates servingSizeDatas from the fetched collection")
        void populatesServingSizeDatas() {
            FoodItemDetail detail = mapper.foodItemToFoodItemDetail(foodItem);

            assertThat(detail.getServingSizeDatas())
                    .extracting(ServingSizeData::getLabel)
                    .containsExactly("1 cup", "1 packet");
        }

        @Test
        @DisplayName("maps quantityInGrams onto grams")
        void mapsQuantityInGrams() {
            FoodItemDetail detail = mapper.foodItemToFoodItemDetail(foodItem);

            assertThat(detail.getServingSizeDatas().get(0).getGrams()).isEqualByComparingTo("81.0");
            assertThat(detail.getServingSizeDatas().get(1).getGrams()).isEqualByComparingTo("28.0");
        }

        @Test
        @DisplayName("yields an empty list when the food item has no serving sizes")
        void handlesEmptyCollection() {
            foodItem.getServingSizes().clear();

            assertThat(mapper.foodItemToFoodItemDetail(foodItem).getServingSizeDatas()).isEmpty();
        }
    }

    @Nested
    @DisplayName("null handling")
    class NullHandling {

        @Test
        @DisplayName("maps a null food item to null")
        void mapsNullEntity() {
            assertThat(mapper.foodItemToFoodItemDetail(null)).isNull();
        }

        @Test
        @DisplayName("leaves optional fields null rather than substituting a default")
        void mapsNullOptionalFields() {
            foodItem.setBrand(null);
            foodItem.setBarcode(null);
            foodItem.setSourceId(null);

            FoodItemDetail detail = mapper.foodItemToFoodItemDetail(foodItem);

            assertThat(detail.getBrand()).isNull();
            assertThat(detail.getBarcode()).isNull();
            assertThat(detail.getSourceId()).isNull();
        }
    }
}
