package com.lazybuff.fuel.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mapstruct.factory.Mappers;

@DisplayName("CustomFoodMapper")
class CustomFoodMapperTest {

    private final CustomFoodMapper mapper = Mappers.getMapper(CustomFoodMapper.class);

    private static CustomFoodRequest request(String name, String brand, String unit, String fiber) {
        return new CustomFoodRequest(
                name,
                brand,
                new BigDecimal("200"),
                unit,
                new BigDecimal("180"),
                new BigDecimal("9.0"),
                new BigDecimal("24.0"),
                new BigDecimal("5.0"),
                fiber == null ? null : new BigDecimal(fiber));
    }

    @Test
    @DisplayName("builds an unsaved USER food without id, owner, source id or barcode")
    void shouldBuildUserFoodFromRequest() {
        FoodItem food = mapper.toEntity(request("Dal", "Home", "g", "4.0"));

        assertThat(food.getSource()).isEqualTo(FoodSource.USER);
        assertThat(food.getId()).isNull();
        assertThat(food.getUser()).isNull();
        assertThat(food.getSourceId()).isNull();
        assertThat(food.getBarcode()).isNull();
        assertThat(food.getServingUnit()).isEqualTo(ServingUnit.G);
        assertThat(food.getCalories()).isEqualByComparingTo("180");
        assertThat(food.getFiber()).isEqualByComparingTo("4.0");
    }

    @Test
    @DisplayName("trims the name and brand")
    void shouldTrimNameAndBrand() {
        FoodItem food = mapper.toEntity(request("  Dal Tadka  ", "  Home  ", "g", null));

        assertThat(food.getName()).isEqualTo("Dal Tadka");
        assertThat(food.getBrand()).isEqualTo("Home");
    }

    @Test
    @DisplayName("turns a blank brand into null")
    void shouldTurnBlankBrandIntoNull() {
        assertThat(mapper.toEntity(request("Dal", "   ", "g", null)).getBrand()).isNull();
    }

    @Test
    @DisplayName("defaults missing fiber to zero")
    void shouldDefaultFiberToZero() {
        assertThat(mapper.toEntity(request("Dal", null, "g", null)).getFiber())
                .isEqualByComparingTo("0");
    }

    @ParameterizedTest
    @CsvSource({
        "g,G",
        "ml,ML",
        "oz,OZ",
        "cup,CUP",
        "tbsp,TBSP",
        "tsp,TSP",
        "piece,PIECE",
        "serving,SERVING"
    })
    @DisplayName("maps each allowed lowercase unit to its enum")
    void shouldMapUnitToEnum(String unit, ServingUnit expected) {
        assertThat(mapper.toEntity(request("Dal", null, unit, null)).getServingUnit())
                .isEqualTo(expected);
    }

    @Test
    @DisplayName("update overwrites editable fields and leaves identity and ownership untouched")
    void shouldUpdateEditableFieldsAndKeepIdentity() {
        UUID id = UUID.randomUUID();
        User owner = User.builder().id(UUID.randomUUID()).build();
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-01-02T03:04:05Z");
        OffsetDateTime updatedAt = OffsetDateTime.parse("2026-01-03T03:04:05Z");
        FoodItem food =
                FoodItem.builder()
                        .id(id)
                        .user(owner)
                        .name("Old")
                        .brand("OldBrand")
                        .source(FoodSource.USER)
                        .barcode("123")
                        .servingSize(BigDecimal.ONE)
                        .servingUnit(ServingUnit.TSP)
                        .calories(BigDecimal.ONE)
                        .protein(BigDecimal.ONE)
                        .carbs(BigDecimal.ONE)
                        .fat(BigDecimal.ONE)
                        .fiber(new BigDecimal("9"))
                        .createdAt(createdAt)
                        .updatedAt(updatedAt)
                        .build();

        mapper.updateEntity(request("  New  ", "  Home ", "cup", null), food);

        assertThat(food.getName()).isEqualTo("New");
        assertThat(food.getBrand()).isEqualTo("Home");
        assertThat(food.getServingUnit()).isEqualTo(ServingUnit.CUP);
        assertThat(food.getServingSize()).isEqualByComparingTo("200");
        assertThat(food.getCalories()).isEqualByComparingTo("180");
        assertThat(food.getFiber()).isEqualByComparingTo("0");
        assertThat(food.getId()).isEqualTo(id);
        assertThat(food.getUser()).isSameAs(owner);
        assertThat(food.getSource()).isEqualTo(FoodSource.USER);
        assertThat(food.getBarcode()).isEqualTo("123");
        assertThat(food.getCreatedAt()).isEqualTo(createdAt);
        assertThat(food.getUpdatedAt()).isEqualTo(updatedAt);
        assertThat(food.getDeletedAt()).isNull();
    }

    @Test
    @DisplayName("update turns a blank brand into null")
    void shouldClearBrandOnUpdateWhenBlank() {
        FoodItem food = mapper.toEntity(request("Dal", "Home", "g", null));

        mapper.updateEntity(request("Dal", "  ", "g", null), food);

        assertThat(food.getBrand()).isNull();
    }

    @Test
    @DisplayName("maps an entity to a response with the owner id and a lowercase unit")
    void shouldMapEntityToResponse() {
        UUID owner = UUID.randomUUID();
        UUID id = UUID.randomUUID();
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-01-02T03:04:05Z");
        FoodItem food =
                FoodItem.builder()
                        .id(id)
                        .user(User.builder().id(owner).build())
                        .name("Dal")
                        .source(FoodSource.USER)
                        .servingSize(new BigDecimal("200.0"))
                        .servingUnit(ServingUnit.TBSP)
                        .calories(new BigDecimal("180.0"))
                        .protein(new BigDecimal("9.00"))
                        .carbs(new BigDecimal("24.00"))
                        .fat(new BigDecimal("5.00"))
                        .createdAt(createdAt)
                        .build();

        CustomFoodResponse response = mapper.toResponse(food);

        assertThat(response.getId()).isEqualTo(id);
        assertThat(response.getCreatedBy()).isEqualTo(owner);
        assertThat(response.getSource()).isEqualTo("USER");
        assertThat(response.getSourceId()).isNull();
        assertThat(response.getServingUnit()).isEqualTo("tbsp");
        assertThat(response.getFiber()).isEqualByComparingTo("0");
        assertThat(response.getCreatedAt()).isEqualTo(createdAt);
    }
}
