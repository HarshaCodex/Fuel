package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.User;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<User>> register(UserRegisterRequest userRegisterRequest) {

        ApiResponse<User> response = ApiResponse.<User>builder().build();
        return ResponseEntity.ok(response);
    }
}
