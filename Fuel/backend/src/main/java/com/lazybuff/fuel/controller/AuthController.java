package com.lazybuff.fuel.controller;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.ResendVerificationRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.dto.VerifyEmailResponse;
import com.lazybuff.fuel.service.AuthService;
import com.lazybuff.fuel.service.VerificationCodeService;
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
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    private final VerificationCodeService verificationCodeService;

    @PostMapping(
            path = "/register",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> register(
            @Valid @RequestBody UserRegisterRequest userRegisterRequest) throws Exception {

        ApiResponse<UserData> response = authService.register(userRegisterRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

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

    @PostMapping(
            path = "/login",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<UserData>> login(
            @RequestBody @Valid LoginReqeust loginReqeust) throws Exception {

        ApiResponse<UserData> response = authService.login(loginReqeust);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    @PostMapping(
            path = "/logout",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody @Valid LogoutRequest logoutRequest)
            throws Exception {

        ApiResponse<Void> response = authService.logout(logoutRequest);

        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
