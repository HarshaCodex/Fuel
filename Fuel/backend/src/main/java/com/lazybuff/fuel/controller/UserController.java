package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "User", description = "The signed-in user's profile and account")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** Returns the caller's profile; the user id comes from the access token's subject. */
    @Operation(
            summary = "Get the signed-in user's profile",
            description =
                    "Use on app launch to restore the session. authProvider is the provider the"
                            + " user originally registered with, even if others were linked later.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Profile of the user identified by the access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User no longer exists (deleted)")
    })
    @GetMapping(path = "/profile", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserProfile>> getProfile(
            @AuthenticationPrincipal String userId) {

        ApiResponse<UserProfile> response = userService.getProfile(UUID.fromString(userId));

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
