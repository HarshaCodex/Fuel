package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.StreakResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.dto.TrackingEntryUpdateRequest;
import com.lazybuff.fuel.service.StreakService;
import com.lazybuff.fuel.service.TrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in user's food diary. The user id always comes from the access token. */
@RestController
@RequestMapping("/api/tracking")
@Tag(name = "Tracking", description = "The signed-in user's food diary")
@RequiredArgsConstructor
public class TrackingController {

    private final TrackingService trackingService;

    private final StreakService streakService;

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

    @Operation(
            summary = "List the caller's entries for a day",
            description =
                    "Oldest first. The date defaults to today in the user's profile timezone.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Entries for the date, possibly empty"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Date is not a valid yyyy-MM-dd value"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User deleted")
    })
    @GetMapping(path = "/entries", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<List<TrackingEntryResponse>>> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate date) {

        return ResponseEntity.ok(trackingService.listByDate(UUID.fromString(userId), date));
    }

    @Operation(summary = "Soft-delete an entry owned by the caller")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "204",
                description = "Entry deleted"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Malformed id"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Entry not found (or another user's), or user deleted")
    })
    @DeleteMapping(path = "/entries/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String userId, @PathVariable UUID id) {

        trackingService.delete(UUID.fromString(userId), id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Update an entry owned by the caller",
            description =
                    "Omitted fields stay unchanged. Changing the amount or quantity recomputes"
                            + " nutrients from the original food. The food cannot be changed.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Entry updated"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description =
                        "Invalid field, malformed id, loggedAt too far ahead, or entry too large"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Entry not found (or another user's), or user deleted")
    })
    @PutMapping(
            path = "/entries/{id}",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<TrackingEntryResponse>> update(
            @AuthenticationPrincipal String userId,
            @PathVariable UUID id,
            @Valid @RequestBody TrackingEntryUpdateRequest request) {

        return ResponseEntity.ok(trackingService.update(UUID.fromString(userId), id, request));
    }

    @Operation(
            summary = "Current and longest logging streak",
            description =
                    "Consecutive days with at least one entry, in the user's profile timezone."
                            + " Today not being logged yet does not break the current streak.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Streak, with lastLoggedDate null when nothing is logged"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "User deleted")
    })
    @GetMapping(path = "/streak", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<StreakResponse>> streak(
            @AuthenticationPrincipal String userId) {

        return ResponseEntity.ok(streakService.get(UUID.fromString(userId)));
    }
}
