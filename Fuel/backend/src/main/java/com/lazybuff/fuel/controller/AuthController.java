package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.ForgotPasswordRequest;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.OAuthAppleRequest;
import com.lazybuff.fuel.dto.OAuthGoogleRequest;
import com.lazybuff.fuel.dto.RefreshTokenRequest;
import com.lazybuff.fuel.dto.RefreshTokenResponse;
import com.lazybuff.fuel.dto.ResendVerificationRequest;
import com.lazybuff.fuel.dto.ResetPasswordRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.dto.VerifyEmailResponse;
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.service.AppleOAuthService;
import com.lazybuff.fuel.service.AuthService;
import com.lazybuff.fuel.service.GoogleOAuthService;
import com.lazybuff.fuel.service.VerificationCodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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

    private final GoogleOAuthService googleOAuthService;

    private final AppleOAuthService appleOAuthService;

    @Operation(
            summary = "Register with email and password",
            description =
                    "Always answers 202 \"check your email\", whether or not the email is taken, so"
                            + " it can't reveal who has an account. A new email gets an account"
                            + " and a verification code; a taken one gets a notice sent to its"
                            + " owner. The user signs in by calling /verify-email with the code.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "202",
                description = "Check your email to continue"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many requests from this IP; see Retry-After")
    })
    @PostMapping(
            path = "/register",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> register(
            @Valid @RequestBody UserRegisterRequest userRegisterRequest) throws Exception {

        ApiResponse<Void> response = authService.register(userRegisterRequest);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @Operation(
            summary = "Verify email with the emailed code and sign in",
            description =
                    "Completes a sign-up: returns access and refresh tokens like /login. A code stops"
                            + " working after too many guesses; request a new one to continue.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Email verified; returns access and refresh tokens"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Code invalid or expired (also for unknown or verified emails)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many incorrect codes; request a new one")
    })
    @PostMapping(
            path = "/verify-email",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest verifyEmailRequest, HttpServletRequest request)
            throws Exception {

        ApiResponse<UserData> response =
                authService.verifyEmail(verifyEmailRequest, ClientInfo.from(request));
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
                description = "Invalid email or password"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "403",
                description = "Correct password, but the email isn't verified yet"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description =
                        "Too many requests from this IP, or too many failed logins for this"
                                + " email (10 per 15 minutes); see Retry-After")
    })
    @PostMapping(
            path = "/login",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> login(
            @RequestBody @Valid LoginReqeust loginReqeust, HttpServletRequest request)
            throws Exception {

        ApiResponse<UserData> response = authService.login(loginReqeust, ClientInfo.from(request));

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
            description =
                    "Revokes all existing sessions on success, and marks the email verified (the"
                            + " code proves the user owns it). A code stops working after too"
                            + " many guesses; request a new one to continue.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Password reset"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Validation failed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Code invalid or expired"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many incorrect codes; request a new one")
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
            @RequestBody @Valid RefreshTokenRequest refreshTokenRequest, HttpServletRequest request)
            throws Exception {

        ApiResponse<RefreshTokenResponse> response =
                authService.refreshToken(refreshTokenRequest, ClientInfo.from(request));

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Sign in or sign up with Google",
            description =
                    "Send the ID token from Google Sign-In on the device. Logs in the linked user, links"
                            + " Google to an existing account with the same email, or creates a new"
                            + " account (isNewUser: true). Linking to an unverified account removes its"
                            + " password and sessions; see ADR 0001.")
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
                description = "ID token invalid, expired, or issued for another app"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "409",
                description = "Account already linked to a different Google account"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "503",
                description = "Google's signing keys could not be fetched"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many requests from this IP; see Retry-After")
    })
    @PostMapping(
            path = "/oauth/google",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> oauthGoogle(
            @Valid @RequestBody OAuthGoogleRequest oAuthGoogleRequest, HttpServletRequest request)
            throws Exception {

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(oAuthGoogleRequest, ClientInfo.from(request));

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @Operation(
            summary = "Sign in or register with Apple",
            description =
                    "Verifies the Apple identity token. Signs in the account already linked to the"
                            + " Apple ID, otherwise links Apple to an existing account with the same"
                            + " email, or creates a new account (isNewUser: true). Linking to an"
                            + " unverified account removes its password and sessions; see ADR 0001."
                            + " Apple only gives the app the user's name on the first sign-in, so"
                            + " send fullName whenever it's available.")
    @SecurityRequirements
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Signed in; returns access and refresh tokens"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description =
                        "Validation failed, or Apple shared no email for an account not yet"
                                + " linked"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Identity token invalid, expired, or issued for another app"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "409",
                description = "Account already linked to a different Apple account"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "429",
                description = "Too many requests from this IP; see Retry-After"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "503",
                description = "Apple's signing keys could not be fetched")
    })
    @PostMapping(
            path = "/oauth/apple",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> oauthApple(
            @Valid @RequestBody OAuthAppleRequest oAuthAppleRequest, HttpServletRequest request)
            throws Exception {

        ApiResponse<UserData> response =
                appleOAuthService.authenticate(oAuthAppleRequest, ClientInfo.from(request));

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
