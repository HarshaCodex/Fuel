package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.service.TrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's food diary. The user id always comes from the access token. */
@RestController
@RequestMapping("/api/tracking")
@Tag(name = "Tracking", description = "The signed-in user's food diary")
@RequiredArgsConstructor
public class TrackingController {

    private final TrackingService trackingService;

    @Operation(
            summary = "Log a food",
            description =
                    "Nutrients are computed from the food's values, the amount and the quantity."
                            + " The entry date is the local date in the user's profile timezone.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "201",
                description = "Entry logged, with computed nutrients"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description =
                        "Invalid field, unit differs from the food's, loggedAt too far ahead, or"
                                + " entry too large"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Food not found (or another user's custom food), or user deleted")
    })
    @PostMapping(
            path = "/entries",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<TrackingEntryResponse>> create(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody TrackingEntryRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(trackingService.create(UUID.fromString(userId), request));
    }
}
