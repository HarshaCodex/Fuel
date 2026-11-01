package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.service.UserService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints for the authenticated user's own account. All require a valid access token. */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** Returns the caller's profile; the user id comes from the access token's subject. */
    @GetMapping(path = "/profile", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserProfile>> getProfile(
            @AuthenticationPrincipal String userId) {

        ApiResponse<UserProfile> response = userService.getProfile(UUID.fromString(userId));

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
