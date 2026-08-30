package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.FoodItemDetail;
import com.lazybuff.fuel.service.FoodService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/food")
public class FoodItemController {

    private final FoodService foodService;

    @GetMapping(path = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<FoodItemDetail>> getFoodById(@PathVariable UUID id) {

        ApiResponse<FoodItemDetail> response = foodService.getFoodById(id);
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
