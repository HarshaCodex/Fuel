package com.lazybuff.fuel.mapper;

import com.lazybuff.fuel.dto.FoodSearchItem;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.service.OffClient.OffFood;
import com.lazybuff.fuel.service.UsdaClient.UsdaFood;
import com.lazybuff.fuel.util.ServingUnit;
import java.util.Locale;
import java.util.UUID;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface FoodSearchMapper {

    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "food.name")
    @Mapping(target = "brand", source = "food.brand")
    @Mapping(target = "source", constant = "USDA")
    @Mapping(target = "sourceId", source = "food.sourceId")
    @Mapping(target = "servingSize", constant = "100")
    @Mapping(target = "servingUnit", constant = "g")
    @Mapping(target = "calories", source = "food.calories")
    @Mapping(target = "protein", source = "food.protein")
    @Mapping(target = "carbs", source = "food.carbs")
    @Mapping(target = "fat", source = "food.fat")
    @Mapping(target = "fiber", source = "food.fiber")
    FoodSearchItem fromUsda(UUID id, UsdaFood food);

    @Mapping(target = "id", source = "id")
    @Mapping(target = "name", source = "food.name")
    @Mapping(target = "brand", source = "food.brand")
    @Mapping(target = "source", constant = "OFF")
    @Mapping(target = "sourceId", source = "food.sourceId")
    @Mapping(target = "servingSize", constant = "100")
    @Mapping(target = "servingUnit", constant = "g")
    @Mapping(target = "calories", source = "food.calories")
    @Mapping(target = "protein", source = "food.protein")
    @Mapping(target = "carbs", source = "food.carbs")
    @Mapping(target = "fat", source = "food.fat")
    @Mapping(target = "fiber", source = "food.fiber")
    FoodSearchItem fromOff(UUID id, OffFood food);

    FoodSearchItem fromCustom(FoodItem foodItem);

    default String servingUnitToString(ServingUnit servingUnit) {
        return servingUnit == null ? null : servingUnit.name().toLowerCase(Locale.ROOT);
    }
}
