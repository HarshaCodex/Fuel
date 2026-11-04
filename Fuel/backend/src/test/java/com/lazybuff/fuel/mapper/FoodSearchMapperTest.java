package com.lazybuff.fuel.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.FoodSearchItem;
import com.lazybuff.fuel.service.OffClient.OffFood;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

@DisplayName("FoodSearchMapper")
class FoodSearchMapperTest {

    private final FoodSearchMapper mapper = Mappers.getMapper(FoodSearchMapper.class);

    @Test
    @DisplayName("maps an OFF product to a per-100 g search item with source OFF")
    void shouldMapOffProduct() {
        UUID id = UUID.randomUUID();
        OffFood food =
                new OffFood(
                        "123",
                        "123",
                        "Granola",
                        "Acme",
                        new BigDecimal("250.5"),
                        new BigDecimal("5.00"),
                        new BigDecimal("30.00"),
                        new BigDecimal("10.00"),
                        new BigDecimal("2.00"));

        FoodSearchItem item = mapper.fromOff(id, food);

        assertThat(item.id()).isEqualTo(id);
        assertThat(item.name()).isEqualTo("Granola");
        assertThat(item.brand()).isEqualTo("Acme");
        assertThat(item.source()).isEqualTo("OFF");
        assertThat(item.sourceId()).isEqualTo("123");
        assertThat(item.servingSize()).isEqualByComparingTo("100");
        assertThat(item.servingUnit()).isEqualTo("g");
        assertThat(item.calories()).isEqualByComparingTo("250.5");
        assertThat(item.protein()).isEqualByComparingTo("5");
        assertThat(item.carbs()).isEqualByComparingTo("30");
        assertThat(item.fat()).isEqualByComparingTo("10");
        assertThat(item.fiber()).isEqualByComparingTo("2");
    }
}
