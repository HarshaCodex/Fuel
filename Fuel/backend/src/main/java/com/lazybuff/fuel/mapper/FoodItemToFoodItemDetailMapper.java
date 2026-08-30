package com.lazybuff.fuel.mapper;

import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.dto.ServingSizeData;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.FoodServingSize;
import com.lazybuff.fuel.util.ServingUnit;
import java.util.Locale;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface FoodItemToFoodItemDetailMapper {

    @Mapping(target = "servingSizeDatas", source = "servingSizes")
    FoodItemDetail foodItemToFoodItemDetail(FoodItem foodItem);

    @Mapping(target = "grams", source = "quantityInGrams")
    ServingSizeData foodServingSizeToServingSizeData(FoodServingSize foodServingSize);

    default String servingUnitToString(ServingUnit servingUnit) {
        return servingUnit == null ? null : servingUnit.name().toLowerCase(Locale.ROOT);
    }
}
