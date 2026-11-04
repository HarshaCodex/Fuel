package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.service.GoalsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's daily goals. The user id always comes from the access token. */
@RestController
@RequestMapping("/api/user/goals")
@Tag(name = "User", description = "The signed-in user's profile and account")
@RequiredArgsConstructor
public class GoalsController {

    private final GoalsService goalsService;

    @Operation(
            summary = "Get the signed-in user's daily goals",
            description = "Returns the defaults (updatedAt null) when none were saved yet.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Stored goals, or the defaults"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User no longer exists (deleted)")
    })
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<GoalsResponse>> get(@AuthenticationPrincipal String userId) {

        return ResponseEntity.ok(goalsService.get(UUID.fromString(userId)));
    }

    @Operation(
            summary = "Set the signed-in user's daily goals",
            description = "All fields are required. Goals are then marked as manually set.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Saved goals"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Malformed body, missing field or a value out of range"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User no longer exists (deleted)")
    })
    @PutMapping(
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<GoalsResponse>> put(
            @AuthenticationPrincipal String userId, @Valid @RequestBody GoalsRequest request) {

        return ResponseEntity.ok(goalsService.put(UUID.fromString(userId), request));
    }
}
