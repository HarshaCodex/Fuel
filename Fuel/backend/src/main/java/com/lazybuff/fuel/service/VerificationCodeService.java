package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.RateLimitConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.ResendVerificationRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.dto.VerifyEmailResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.repository.VerificationCodeRepository;
import com.lazybuff.fuel.util.TokenHasher;
import com.lazybuff.fuel.util.VerifyType;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class VerificationCodeService {

    private final VerificationCodeRepository verificationCodeRepository;

    private final UserRepository userRepository;

    private final EmailService emailService;

    private final RateLimiterService rateLimiterService;

    private final RateLimitConfig rateLimitConfig;

    @NoLogging
    public String generateVerificationCode(User user) throws NoSuchAlgorithmException {

        SecureRandom secureRandom = new SecureRandom();
        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 5; i++) {
            code.append(secureRandom.nextInt(10));
        }

        VerificationCode verificationCode =
                VerificationCode.builder()
                        .user(user)
                        .codeHash(TokenHasher.sha256Hex(code.toString()))
                        .type(VerifyType.EMAIL_VERIFY)
                        .expires_at(Instant.now().plus(Duration.ofHours(24)))
                        .usedAt(null)
                        .build();

        verificationCodeRepository.save(verificationCode);

        emailService.sendEmail(user.getEmail(), code.toString());

        return code.toString();
    }

    @Transactional
    @NoLogging
    public ApiResponse<VerifyEmailResponse> verifyEmail(VerifyEmailRequest verifyEmailRequest)
            throws NoSuchAlgorithmException {

        try {

            String codeHash = TokenHasher.sha256Hex(verifyEmailRequest.getVerificationCode());

            User user = userRepository.findByEmailAndDeletedAtIsNull(verifyEmailRequest.getEmail());

            if (user == null) {
                throw new FuelException(
                        HttpStatus.UNAUTHORIZED, "Invalid or expired verification code");
            }

            if (user.isEmailVerified()) {
                throw new FuelException(HttpStatus.CONFLICT, "Email already verified");
            }

            VerificationCode code =
                    verificationCodeRepository
                            .findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(
                                    user.getId(), VerifyType.EMAIL_VERIFY, codeHash)
                            .orElseThrow(
                                    () ->
                                            new FuelException(
                                                    HttpStatus.UNAUTHORIZED,
                                                    "Invalid or expired verification code"));

            if (!code.getExpires_at().isAfter(Instant.now())) {
                throw new FuelException(
                        HttpStatus.UNAUTHORIZED, "Invalid or expired verification code");
            }

            code.setUsedAt(Instant.now());
            user.setEmailVerified(true);

            return ApiResponse.<VerifyEmailResponse>builder()
                    .status(HttpStatus.OK.value())
                    .message("Email verified successfully")
                    .data(VerifyEmailResponse.builder().emailVerified(true).build())
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error(
                    "Exception while verifying email for user with email:{}",
                    verifyEmailRequest.getEmail());
            throw e;
        }
    }

    @Transactional
    @NoLogging
    public ApiResponse<VerifyEmailResponse> resendVerification(
            ResendVerificationRequest resendVerificationRequest) {

        String key =
                "rate_limit:resend-verification:"
                        + resendVerificationRequest.getEmail().toLowerCase();

        if (!rateLimiterService.isAllowed(
                key, rateLimitConfig.getMaxRequests(), rateLimitConfig.getWindow())) {
            throw new FuelException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Too many verification requests. Please try again later!");
        }

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            resendVerificationRequest.getEmail());

            verificationCodeRepository.invalidateAllVerificationCodes(
                    user, VerifyType.EMAIL_VERIFY);

            generateVerificationCode(user);
        } catch (Exception e) {
            log.error("Error while resending verification: ", e);
        }

        return ApiResponse.<VerifyEmailResponse>builder()
                .status(HttpStatus.OK.value())
                .message(
                        "If this email is registered and unverified, a new verification email has been sent.")
                .timestamp(LocalDateTime.now())
                .build();
    }
}
