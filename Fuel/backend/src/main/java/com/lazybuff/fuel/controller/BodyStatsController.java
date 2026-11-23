package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.BodyStatsRequest;
import com.lazybuff.fuel.dto.BodyStatsResponse;
import com.lazybuff.fuel.service.BodyStatsService;
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

/** The signed-in user's body stats. The user id always comes from the access token. */
@RestController
@RequestMapping("/api/user/body-stats")
@Tag(name = "User", description = "The signed-in user's profile and account")
@RequiredArgsConstructor
public class BodyStatsController {

    private final BodyStatsService bodyStatsService;

    @Operation(
            summary = "Get the signed-in user's body stats",
            description = "Always metric. data is null when the user has not saved any yet.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Body stats, or null data if never set"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User no longer exists (deleted)")
    })
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<BodyStatsResponse>> get(
            @AuthenticationPrincipal String userId) {

        return ResponseEntity.ok(bodyStatsService.get(UUID.fromString(userId)));
    }

    @Operation(
            summary = "Create or replace the signed-in user's body stats",
            description =
                    "All fields are required. Height and weight may be sent in cm/ft and kg/lbs;"
                            + " the response is always metric.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Saved body stats"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description =
                        "Missing field, unknown unit/gender/activity level, or a value out of range"),
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
    public ResponseEntity<ApiResponse<BodyStatsResponse>> put(
            @AuthenticationPrincipal String userId, @Valid @RequestBody BodyStatsRequest request) {

        return ResponseEntity.ok(bodyStatsService.put(UUID.fromString(userId), request));
    }
}
