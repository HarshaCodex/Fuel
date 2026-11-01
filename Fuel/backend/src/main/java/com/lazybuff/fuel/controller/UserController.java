package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DeleteAccountRequest;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.service.UserService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    /** Deletes the caller's account once they confirm they own it. */
    @Operation(
            summary = "Delete the signed-in user's account",
            description =
                    "Send exactly one confirmation: the password, or a fresh googleIdToken /"
                            + " appleIdentityToken from re-running that sign-in (for accounts"
                            + " without a password). Sign-in methods and all sessions are removed"
                            + " immediately and the email can be used to sign up again; the data"
                            + " is permanently erased after a 30-day grace period. Discard the"
                            + " stored tokens on success.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Account deleted"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description =
                        "Not exactly one confirmation, or a password sent for an account without"
                                + " one"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description =
                        "Missing/invalid access token, wrong password, or a token for an account"
                                + " that isn't linked"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Account already deleted"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many attempts; see Retry-After"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "503",
                description = "Google's or Apple's signing keys could not be fetched")
    })
    @DeleteMapping(
            path = "/account",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> deleteAccount(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody DeleteAccountRequest deleteAccountRequest) {

        ApiResponse<Void> response =
                userService.deleteAccount(UUID.fromString(userId), deleteAccountRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
