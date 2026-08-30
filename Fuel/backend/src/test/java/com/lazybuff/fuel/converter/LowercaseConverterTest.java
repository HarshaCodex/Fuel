package com.lazybuff.fuel.converter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lazybuff.fuel.util.ServingUnit;
import java.util.Locale;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("LowercaseConverter")
class LowercaseConverterTest {

    private final LowercaseConverter converter = new LowercaseConverter();

    @Nested
    @DisplayName("convertToDatabaseColumn")
    class ToDatabaseColumn {

        @ParameterizedTest
        @EnumSource(ServingUnit.class)
        @DisplayName("writes the lowercase form accepted by chk_food_serving_unit")
        void writesLowercase(ServingUnit servingUnit) {
            assertThat(converter.convertToDatabaseColumn(servingUnit))
                    .isEqualTo(servingUnit.name().toLowerCase(Locale.ROOT));
        }

        @Test
        @DisplayName("passes null through")
        void handlesNull() {
            assertThat(converter.convertToDatabaseColumn(null)).isNull();
        }
    }

    @Nested
    @DisplayName("convertToEntityAttribute")
    class ToEntityAttribute {

        @ParameterizedTest
        @EnumSource(ServingUnit.class)
        @DisplayName("reads back every unit the column can hold")
        void readsEveryUnit(ServingUnit servingUnit) {
            String stored = servingUnit.name().toLowerCase(Locale.ROOT);

            assertThat(converter.convertToEntityAttribute(stored)).isEqualTo(servingUnit);
        }

        @ParameterizedTest
        @ValueSource(strings = {"g", "ml", "oz", "cup", "tbsp", "tsp", "piece", "serving"})
        @DisplayName("reads every literal listed in the chk_food_serving_unit constraint")
        void readsEveryConstraintLiteral(String stored) {
            assertThat(converter.convertToEntityAttribute(stored)).isNotNull();
        }

        @Test
        @DisplayName("passes null through")
        void handlesNull() {
            assertThat(converter.convertToEntityAttribute(null)).isNull();
        }

        @Test
        @DisplayName("rejects a value outside the enum rather than returning null")
        void rejectsUnknownValue() {
            assertThatThrownBy(() -> converter.convertToEntityAttribute("furlong"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    @DisplayName("round-trips every unit through the database representation")
    void roundTrips() {
        for (ServingUnit servingUnit : ServingUnit.values()) {
            String stored = converter.convertToDatabaseColumn(servingUnit);

            assertThat(converter.convertToEntityAttribute(stored)).isEqualTo(servingUnit);
        }
    }
}
