package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.ForgotPasswordRequest;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.RefreshTokenRequest;
import com.lazybuff.fuel.dto.RefreshTokenResponse;
import com.lazybuff.fuel.dto.ResendVerificationRequest;
import com.lazybuff.fuel.dto.ResetPasswordRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.dto.VerifyEmailResponse;
import com.lazybuff.fuel.service.AuthService;
import com.lazybuff.fuel.service.VerificationCodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.security.NoSuchAlgorithmException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Registration, login, sessions and password recovery")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    private final VerificationCodeService verificationCodeService;

    @Operation(
            summary = "Register with email and password",
            description =
                    "Creates the account, emails a verification code and signs the user in. The account works before verification; emailVerified is false until /verify-email succeeds.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "201",
                description = "Registered and signed in"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "409",
                description = "Email already registered")
    })
    @PostMapping(
            path = "/register",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> register(
            @Valid @RequestBody UserRegisterRequest userRegisterRequest) throws Exception {

        ApiResponse<UserData> response = authService.register(userRegisterRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Verify email with the emailed code")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Email verified"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Code invalid or expired"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "409",
                description = "Email already verified")
    })
    @PostMapping(
            path = "/verify-email",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<VerifyEmailResponse>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest verifyEmailRequest)
            throws NoSuchAlgorithmException {

        ApiResponse<VerifyEmailResponse> response =
                verificationCodeService.verifyEmail(verifyEmailRequest);
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Resend the email verification code",
            description = "Rate limited per email address.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Code sent if the account exists and is unverified"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many requests for this email")
    })
    @PostMapping(
            path = "/resend-verification",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<VerifyEmailResponse>> resendVerification(
            @Valid @RequestBody ResendVerificationRequest resendVerificationRequest) {

        ApiResponse<VerifyEmailResponse> response =
                verificationCodeService.resendVerification(resendVerificationRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(summary = "Log in with email and password")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Signed in; returns access and refresh tokens"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Invalid email or password")
    })
    @PostMapping(
            path = "/login",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> login(
            @RequestBody @Valid LoginReqeust loginReqeust) throws Exception {

        ApiResponse<UserData> response = authService.login(loginReqeust);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Log out the current session",
            description =
                    "Revokes the given refresh token. Requires the access token of the same user.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Logged out"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Missing or invalid access token")
    })
    @PostMapping(
            path = "/logout",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody @Valid LogoutRequest logoutRequest)
            throws Exception {

        ApiResponse<Void> response = authService.logout(logoutRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Request a password reset code",
            description =
                    "Always responds 200 so callers cannot probe which emails are registered. Rate limited per email address.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Reset code sent if the account exists"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many requests for this email")
    })
    @PostMapping(
            path = "/forgot-password",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest forgotPasswordRequest) {

        ApiResponse<Void> response = verificationCodeService.forgotPassword(forgotPasswordRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Reset password with the emailed code",
            description = "Revokes all existing sessions on success.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Password reset"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed or email not verified"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Code invalid or expired")
    })
    @PostMapping(
            path = "/reset-password",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @RequestBody @Valid ResetPasswordRequest resetPasswordRequest) throws Exception {

        ApiResponse<Void> response = authService.resetPassword(resetPasswordRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Exchange a refresh token for new tokens",
            description =
                    "Rotates the refresh token: the old one stops working. Reusing a rotated token revokes all of the user's sessions (replay detection).")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "New access and refresh tokens"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Refresh token invalid, expired or revoked")
    })
    @PostMapping(
            path = "/refresh",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RefreshTokenResponse>> refreshToken(
            @RequestBody @Valid RefreshTokenRequest refreshTokenRequest) throws Exception {

        ApiResponse<RefreshTokenResponse> response = authService.refreshToken(refreshTokenRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
