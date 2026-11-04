package com.lazybuff.fuel.mapper;

import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.util.ServingUnit;
import java.util.Locale;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CustomFoodMapper {

    /** Builds an unsaved USER food; the caller sets the owner. */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "user", ignore = true)
    @Mapping(target = "servingSizes", ignore = true)
    @Mapping(target = "source", constant = "USER")
    @Mapping(target = "sourceId", ignore = true)
    @Mapping(target = "barcode", ignore = true)
    @Mapping(target = "fiber", source = "fiber", defaultValue = "0")
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    FoodItem toEntity(CustomFoodRequest request);

    @Mapping(target = "createdBy", source = "user.id")
    CustomFoodResponse toResponse(FoodItem foodItem);

    default String servingUnitToString(ServingUnit servingUnit) {
        return servingUnit == null ? null : servingUnit.name().toLowerCase(Locale.ROOT);
    }

    default ServingUnit stringToServingUnit(String value) {
        return value == null ? null : ServingUnit.valueOf(value.toUpperCase(Locale.ROOT));
    }

    /** Trims text; a blank value becomes null. */
    default String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
