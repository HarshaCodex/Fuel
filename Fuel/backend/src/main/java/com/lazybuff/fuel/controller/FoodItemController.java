package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.FoodItemDetail;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/food")
public class FoodItemController {

    @RequestMapping("/{id}")
    public FoodItemDetail getFoodById(@PathVariable UUID id) {
        return null;
    }
}
