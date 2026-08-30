package com.lazybuff.fuel.mapper;

import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.entity.FoodItem;
import org.mapstruct.Mapper;

@Mapper
public interface FoodItemToFoodItemDetailMapper {

    FoodItemDetail foodItemToFoodItemDetail(FoodItem foodItem);
}
