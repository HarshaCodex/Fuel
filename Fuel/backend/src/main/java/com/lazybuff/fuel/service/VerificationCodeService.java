package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.RateLimitConfig;
import com.lazybuff.fuel.config.VerificationCodeConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.ForgotPasswordRequest;
import com.lazybuff.fuel.dto.ResendVerificationRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.dto.VerifyEmailResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.repository.VerificationCodeRepository;
import com.lazybuff.fuel.util.EmailNormalizer;
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

    private final VerificationCodeConfig verificationCodeConfig;

    private static final String INVALID_CODE_MESSAGE = "Invalid or expired verification code";

    private static final String TOO_MANY_ATTEMPTS_MESSAGE =
            "Too many incorrect codes. Please request a new code.";

    @NoLogging
    public String generateVerificationCode(User user, VerifyType verifyType)
            throws NoSuchAlgorithmException {

        SecureRandom secureRandom = new SecureRandom();
        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 5; i++) {
            code.append(secureRandom.nextInt(10));
        }

        VerificationCode verificationCode =
                VerificationCode.builder()
                        .user(user)
                        .codeHash(TokenHasher.sha256Hex(code.toString()))
                        .type(verifyType)
                        .expires_at(Instant.now().plus(codeExpiry(verifyType)))
                        .usedAt(null)
                        .build();

        verificationCodeRepository.save(verificationCode);
        // A new code gets a fresh guess budget; callers invalidate the previous codes first.
        rateLimiterService.reset(attemptsKey(user, verifyType));

        if (verifyType.equals(VerifyType.PASSWORD_RESET)) {
            emailService.sendResetPasswordEmail(user.getEmail(), code.toString());
        } else {
            emailService.sendEmail(user.getEmail(), code.toString());
        }

        return code.toString();
    }

    /**
     * Returns the user's unused, unexpired code of {@code verifyType} matching {@code rawCode}.
     *
     * <p>Every guess counts against the code, so it stops working after {@code
     * app.verification-code.max-attempts} tries until a new one is requested; a correct guess
     * clears the count. The caller marks the returned code as used.
     *
     * @throws FuelException 401 when the code is wrong, used or expired
     * @throws com.lazybuff.fuel.exception.RateLimitExceededException when guesses are exhausted
     */
    @NoLogging
    public VerificationCode findValidCode(User user, VerifyType verifyType, String rawCode)
            throws NoSuchAlgorithmException {

        String attemptsKey = attemptsKey(user, verifyType);

        // Counted before the lookup so a correct guess beyond the limit is rejected too.
        rateLimiterService.enforce(
                attemptsKey,
                verificationCodeConfig.getMaxAttempts(),
                codeExpiry(verifyType),
                TOO_MANY_ATTEMPTS_MESSAGE);

        VerificationCode code =
                verificationCodeRepository
                        .findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(
                                user.getId(), verifyType, TokenHasher.sha256Hex(rawCode))
                        .filter(c -> c.getExpires_at().isAfter(Instant.now()))
                        .orElseThrow(
                                () ->
                                        new FuelException(
                                                HttpStatus.UNAUTHORIZED, INVALID_CODE_MESSAGE));

        rateLimiterService.reset(attemptsKey);
        return code;
    }

    private static Duration codeExpiry(VerifyType verifyType) {
        return verifyType.equals(VerifyType.PASSWORD_RESET)
                ? Duration.ofMinutes(15)
                : Duration.ofHours(24);
    }

    // Keyed by user id, not email, so no personal data ends up in Redis.
    private static String attemptsKey(User user, VerifyType verifyType) {
        return "verification_attempts:" + verifyType + ":" + user.getId();
    }

    /**
     * Marks the user's email verified if the code is valid, and returns the user.
     *
     * <p>An unknown email, an already-verified account and a wrong code all get the same 401, so
     * the endpoint can't be used to find out which emails have accounts (#86).
     *
     * @throws FuelException 401 when the code can't be used for this email
     * @throws com.lazybuff.fuel.exception.RateLimitExceededException when guesses are exhausted
     */
    @Transactional
    @NoLogging
    public User confirmEmail(VerifyEmailRequest verifyEmailRequest)
            throws NoSuchAlgorithmException {

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(verifyEmailRequest.getEmail()));

            if (user == null || user.isEmailVerified()) {
                throw new FuelException(HttpStatus.UNAUTHORIZED, INVALID_CODE_MESSAGE);
            }

            VerificationCode code =
                    findValidCode(
                            user,
                            VerifyType.EMAIL_VERIFY,
                            verifyEmailRequest.getVerificationCode());

            code.setUsedAt(Instant.now());
            user.setEmailVerified(true);
            return user;

        } catch (Exception e) {
            log.error("Exception while verifying an email: {}", e.getClass().getSimpleName());
            throw e;
        }
    }

    @Transactional
    @NoLogging
    public ApiResponse<VerifyEmailResponse> resendVerification(
            ResendVerificationRequest resendVerificationRequest) {

        String key =
                "rate_limit:resend-verification:"
                        + EmailNormalizer.normalize(resendVerificationRequest.getEmail());

        rateLimiterService.enforce(
                key,
                rateLimitConfig.getMaxRequests(),
                rateLimitConfig.getWindow(),
                "Too many verification requests. Please try again later!");

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(resendVerificationRequest.getEmail()));

            verificationCodeRepository.invalidateAllVerificationCodes(
                    user, VerifyType.EMAIL_VERIFY);

            generateVerificationCode(user, VerifyType.EMAIL_VERIFY);

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

    @Transactional
    @NoLogging
    public ApiResponse<Void> forgotPassword(ForgotPasswordRequest forgotPasswordRequest) {

        String key =
                "rate_limit:forgot-password:"
                        + EmailNormalizer.normalize(forgotPasswordRequest.getEmail());

        rateLimiterService.enforce(
                key,
                rateLimitConfig.getMaxRequests(),
                rateLimitConfig.getWindow(),
                "Too many forgot password requests. Please try again later!");

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(forgotPasswordRequest.getEmail()));

            if (user == null) {
                return ApiResponse.<Void>builder()
                        .status(HttpStatus.OK.value())
                        .message(
                                "If an account with this email exists, a reset link has been sent.")
                        .build();
            }

            verificationCodeRepository.invalidateAllVerificationCodes(
                    user, VerifyType.PASSWORD_RESET);

            generateVerificationCode(user, VerifyType.PASSWORD_RESET);

        } catch (Exception exception) {
            log.error("Error while resending forgot password link: ", exception);
        }

        return ApiResponse.<Void>builder()
                .status(HttpStatus.OK.value())
                .message("If an account with this email exists, a reset link has been sent.")
                .build();
    }
}
