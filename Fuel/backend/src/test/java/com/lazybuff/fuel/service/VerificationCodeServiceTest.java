package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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
import com.lazybuff.fuel.exception.RateLimitExceededException;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.repository.VerificationCodeRepository;
import com.lazybuff.fuel.util.VerifyType;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("VerificationCodeService")
class VerificationCodeServiceTest {

    @Mock private VerificationCodeRepository verificationCodeRepository;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private RateLimitConfig rateLimitConfig;
    @Mock private RateLimiterService rateLimiterService;

    private VerificationCodeService verificationCodeService;

    @Captor private ArgumentCaptor<VerificationCode> codeCaptor;
    @Captor private ArgumentCaptor<String> emailedCodeCaptor;

    private User user;

    private static final String RESEND_MESSAGE =
            "If this email is registered and unverified, a new verification email has been sent.";

    @BeforeEach
    void setUp() {
        verificationCodeService =
                new VerificationCodeService(
                        verificationCodeRepository,
                        userRepository,
                        emailService,
                        rateLimiterService,
                        rateLimitConfig,
                        new VerificationCodeConfig(),
                        TestDataFactory.codeHasher());
        user = TestDataFactory.persistedUser();
    }

    private VerifyEmailRequest verifyRequest(String code) {
        return VerifyEmailRequest.builder()
                .email(TestDataFactory.EMAIL)
                .verificationCode(code)
                .build();
    }

    /** Stubs the code lookup for the canonical VALID_CODE hash so tests read declaratively. */
    private void stubCodeLookup(Optional<VerificationCode> result) {
        when(verificationCodeRepository.findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(
                        TestDataFactory.USER_ID,
                        VerifyType.EMAIL_VERIFY,
                        TestDataFactory.codeHash(TestDataFactory.VALID_CODE)))
                .thenReturn(result);
    }

    @Nested
    @DisplayName("generateVerificationCode")
    class GenerateVerificationCode {

        @Test
        @DisplayName("persists an unused EMAIL_VERIFY code hashed with a ~24h expiry")
        void persistsHashedCode() throws Exception {
            String returned =
                    verificationCodeService.generateVerificationCode(user, VerifyType.EMAIL_VERIFY);

            verify(verificationCodeRepository).save(codeCaptor.capture());
            VerificationCode saved = codeCaptor.getValue();

            assertThat(saved.getUser()).isSameAs(user);
            assertThat(saved.getType()).isEqualTo(VerifyType.EMAIL_VERIFY);
            assertThat(saved.getUsedAt()).isNull();
            // Only the hash is stored, never the raw code.
            assertThat(saved.getCodeHash()).isEqualTo(TestDataFactory.codeHash(returned));
            assertThat(saved.getCodeHash()).isNotEqualTo(returned);
            assertThat(saved.getExpires_at())
                    .isBetween(
                            Instant.now().plusSeconds(23 * 3600),
                            Instant.now().plusSeconds(25 * 3600));
        }

        @Test
        @DisplayName("emails the raw code to the user after the code is persisted")
        void emailsRawCodeAfterPersisting() throws Exception {
            String returned =
                    verificationCodeService.generateVerificationCode(user, VerifyType.EMAIL_VERIFY);

            verify(emailService).sendEmail(eq(TestDataFactory.EMAIL), emailedCodeCaptor.capture());
            assertThat(emailedCodeCaptor.getValue()).isEqualTo(returned);

            // Regression (#6): the code must be persisted before the email goes out, otherwise a
            // save failure would leave the user holding a code that can never verify.
            InOrder inOrder = inOrder(verificationCodeRepository, emailService);
            inOrder.verify(verificationCodeRepository).save(any(VerificationCode.class));
            inOrder.verify(emailService).sendEmail(anyString(), anyString());
        }

        @Test
        @DisplayName("gives a new code a fresh guess budget")
        void resetsGuessCountForNewCode() throws Exception {
            verificationCodeService.generateVerificationCode(user, VerifyType.PASSWORD_RESET);

            verify(rateLimiterService)
                    .reset("verification_attempts:PASSWORD_RESET:" + TestDataFactory.USER_ID);
        }

        @Test
        @DisplayName("returns a 5-digit numeric code")
        void returnsFiveDigitNumericCode() throws Exception {
            String code =
                    verificationCodeService.generateVerificationCode(user, VerifyType.EMAIL_VERIFY);

            assertThat(code).hasSize(5);
            assertThat(code).containsPattern("^[0-9]{5}$");
        }

        @Test
        @DisplayName("draws digits from the full 0-9 range, not a truncated subset")
        void drawsFromFullDigitRange() throws Exception {
            // Regression (#2): a nextInt(5) bug would only ever emit digits 0-4. Across many
            // generations every digit 0-9 must appear; missing 5-9 flags the truncated range.
            Set<Character> seen = new HashSet<>();
            for (int i = 0; i < 200; i++) {
                for (char c :
                        verificationCodeService
                                .generateVerificationCode(user, VerifyType.EMAIL_VERIFY)
                                .toCharArray()) {
                    seen.add(c);
                }
            }

            for (char digit = '0'; digit <= '9'; digit++) {
                assertThat(seen).contains(digit);
            }
        }

        @Test
        @DisplayName("persists an unused PASSWORD_RESET code hashed with a ~15m expiry")
        void persistsHashedPasswordResetCode() throws Exception {
            String returned =
                    verificationCodeService.generateVerificationCode(
                            user, VerifyType.PASSWORD_RESET);

            verify(verificationCodeRepository).save(codeCaptor.capture());
            VerificationCode saved = codeCaptor.getValue();

            assertThat(saved.getUser()).isSameAs(user);
            assertThat(saved.getType()).isEqualTo(VerifyType.PASSWORD_RESET);
            assertThat(saved.getUsedAt()).isNull();
            assertThat(saved.getCodeHash()).isEqualTo(TestDataFactory.codeHash(returned));
            assertThat(saved.getExpires_at())
                    .isBetween(
                            Instant.now().plusSeconds(14 * 60), Instant.now().plusSeconds(16 * 60));
        }

        @Test
        @DisplayName("emails a PASSWORD_RESET code via sendResetPasswordEmail, never sendEmail")
        void emailsPasswordResetCodeViaResetPasswordEmail() throws Exception {
            String returned =
                    verificationCodeService.generateVerificationCode(
                            user, VerifyType.PASSWORD_RESET);

            verify(emailService)
                    .sendResetPasswordEmail(eq(TestDataFactory.EMAIL), emailedCodeCaptor.capture());
            assertThat(emailedCodeCaptor.getValue()).isEqualTo(returned);

            // Regression: forgot-password must never fall back to the plain OTP email.
            verify(emailService, never()).sendEmail(anyString(), anyString());
        }

        @Test
        @DisplayName("emails an EMAIL_VERIFY code via sendEmail, never sendResetPasswordEmail")
        void emailsEmailVerifyCodeViaSendEmailOnly() throws Exception {
            verificationCodeService.generateVerificationCode(user, VerifyType.EMAIL_VERIFY);

            verify(emailService, never()).sendResetPasswordEmail(anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("findValidCode")
    class FindValidCode {

        private final String attemptsKey =
                "verification_attempts:PASSWORD_RESET:" + TestDataFactory.USER_ID;

        private void stubResetCodeLookup(Optional<VerificationCode> result) {
            when(verificationCodeRepository.findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(
                            TestDataFactory.USER_ID,
                            VerifyType.PASSWORD_RESET,
                            TestDataFactory.codeHash(TestDataFactory.VALID_CODE)))
                    .thenReturn(result);
        }

        @Test
        @DisplayName("counts the guess per user with the default limit and the code's lifetime")
        void countsGuessAgainstCodeLifetime() throws Exception {
            stubResetCodeLookup(Optional.of(TestDataFactory.validPasswordResetCode(user)));

            verificationCodeService.findValidCode(
                    user, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE);

            verify(rateLimiterService)
                    .enforce(
                            eq(attemptsKey),
                            eq(5),
                            eq(Duration.ofMinutes(15)),
                            eq("Too many incorrect codes. Please request a new code."));
        }

        @Test
        @DisplayName("keys the count by user id so no email is stored in Redis")
        void keysCountByUserId() throws Exception {
            stubResetCodeLookup(Optional.of(TestDataFactory.validPasswordResetCode(user)));

            verificationCodeService.findValidCode(
                    user, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE);

            ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
            verify(rateLimiterService).enforce(keyCaptor.capture(), anyInt(), any(), anyString());
            assertThat(keyCaptor.getValue()).doesNotContain(TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("returns the code and clears the count after a correct guess")
        void clearsCountOnCorrectGuess() throws Exception {
            VerificationCode code = TestDataFactory.validPasswordResetCode(user);
            stubResetCodeLookup(Optional.of(code));

            VerificationCode found =
                    verificationCodeService.findValidCode(
                            user, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE);

            assertThat(found).isSameAs(code);
            verify(rateLimiterService).reset(attemptsKey);
        }

        @Test
        @DisplayName("throws 401 and keeps the count after a wrong guess")
        void keepsCountOnWrongGuess() {
            stubResetCodeLookup(Optional.empty());

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.findValidCode(
                                            user,
                                            VerifyType.PASSWORD_RESET,
                                            TestDataFactory.VALID_CODE))
                    .isInstanceOf(FuelException.class)
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            verify(rateLimiterService, never()).reset(anyString());
        }

        @Test
        @DisplayName("throws 401 for an expired code even when it matches")
        void rejectsExpiredCode() {
            stubResetCodeLookup(
                    Optional.of(
                            TestDataFactory.verificationCode(
                                    user,
                                    TestDataFactory.VALID_CODE,
                                    Instant.now().minusSeconds(1),
                                    VerifyType.PASSWORD_RESET)));

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.findValidCode(
                                            user,
                                            VerifyType.PASSWORD_RESET,
                                            TestDataFactory.VALID_CODE))
                    .isInstanceOf(FuelException.class)
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            verify(rateLimiterService, never()).reset(anyString());
        }

        @Test
        @DisplayName("rejects with 429 once guesses are used up, without checking the code")
        void rejectsWhenGuessesExhausted() {
            doThrow(new RateLimitExceededException("Too many", Duration.ofMinutes(10)))
                    .when(rateLimiterService)
                    .enforce(eq(attemptsKey), anyInt(), any(), anyString());

            // Even the correct code is refused, otherwise the limit would only slow guessing down.
            assertThatThrownBy(
                            () ->
                                    verificationCodeService.findValidCode(
                                            user,
                                            VerifyType.PASSWORD_RESET,
                                            TestDataFactory.VALID_CODE))
                    .isInstanceOf(RateLimitExceededException.class);

            verifyNoInteractions(verificationCodeRepository);
        }

        @Test
        @DisplayName("gives email-verification codes their 24h lifetime as the count window")
        void usesEmailVerifyLifetime() throws Exception {
            stubCodeLookup(Optional.of(TestDataFactory.validVerificationCode(user)));

            verificationCodeService.findValidCode(
                    user, VerifyType.EMAIL_VERIFY, TestDataFactory.VALID_CODE);

            verify(rateLimiterService)
                    .enforce(
                            eq("verification_attempts:EMAIL_VERIFY:" + TestDataFactory.USER_ID),
                            eq(5),
                            eq(Duration.ofHours(24)),
                            anyString());
        }
    }

    @Nested
    @DisplayName("confirmEmail - success")
    class VerifyEmailSuccess {

        @Test
        @DisplayName("marks the code used, flips emailVerified, and returns the user")
        void verifiesValidCode() throws Exception {
            VerificationCode code = TestDataFactory.validVerificationCode(user);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            stubCodeLookup(Optional.of(code));

            User verified =
                    verificationCodeService.confirmEmail(verifyRequest(TestDataFactory.VALID_CODE));

            assertThat(verified).isSameAs(user);
            assertThat(user.isEmailVerified()).isTrue();
            assertThat(code.getUsedAt()).isNotNull();
            verifyNoInteractions(emailService);
        }

        @Test
        @DisplayName("finds the account when the email differs only by case")
        void verifiesWhenEmailCaseDiffers() throws Exception {
            VerificationCode code = TestDataFactory.validVerificationCode(user);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            stubCodeLookup(Optional.of(code));
            VerifyEmailRequest request = verifyRequest(TestDataFactory.VALID_CODE);
            request.setEmail(" " + TestDataFactory.EMAIL.toUpperCase() + " ");

            verificationCodeService.confirmEmail(request);

            assertThat(user.isEmailVerified()).isTrue();
        }
    }

    @Nested
    @DisplayName("confirmEmail - failures")
    class VerifyEmailFailure {

        @Test
        @DisplayName("throws 401 and does NOT verify the user when the code is unknown")
        void rejectsUnknownCode() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            // The submitted code hashes to a value that is not present in the store.
            stubCodeLookup(Optional.empty());

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.confirmEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            // Regression (#1): an invalid code must never leave the account marked verified.
            assertThat(user.isEmailVerified()).isFalse();
        }

        @Test
        @DisplayName("throws 401 and leaves the code unused when the code is expired")
        void rejectsExpiredCode() {
            VerificationCode expired =
                    TestDataFactory.verificationCode(
                            user, TestDataFactory.VALID_CODE, Instant.now().minusSeconds(1));
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            stubCodeLookup(Optional.of(expired));

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.confirmEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            assertThat(user.isEmailVerified()).isFalse();
            assertThat(expired.getUsedAt()).isNull();
        }

        @Test
        @DisplayName("throws 429 and does NOT verify the user once guesses are used up")
        void rejectsWhenGuessesExhausted() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            doThrow(new RateLimitExceededException("Too many", Duration.ofHours(1)))
                    .when(rateLimiterService)
                    .enforce(anyString(), anyInt(), any(), anyString());

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.confirmEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(RateLimitExceededException.class);

            assertThat(user.isEmailVerified()).isFalse();
        }

        @Test
        @DisplayName("throws 401 (not NPE/500) when the email is not registered")
        void rejectsUnknownEmailWithoutNpe() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.confirmEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            // No user means there is nothing to look up.
            verify(verificationCodeRepository, never())
                    .findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(any(), any(), anyString());
        }

        @Test
        @DisplayName("throws the same 401 as a wrong code when the email is already verified")
        void rejectsAlreadyVerifiedEmail() {
            user.setEmailVerified(true);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.confirmEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            verify(verificationCodeRepository, never())
                    .findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(any(), any(), anyString());
        }
    }

    @Nested
    @DisplayName("resendVerification")
    class ResendVerification {

        private ResendVerificationRequest resendRequest() {
            return ResendVerificationRequest.builder().email(TestDataFactory.EMAIL).build();
        }

        @Test
        @DisplayName("invalidates existing codes then issues and emails a fresh one")
        void invalidatesThenReissues() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            ApiResponse<VerifyEmailResponse> response =
                    verificationCodeService.resendVerification(resendRequest());

            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(RESEND_MESSAGE);

            // Old codes are invalidated before a new one is persisted/sent.
            InOrder inOrder = inOrder(verificationCodeRepository, emailService);
            inOrder.verify(verificationCodeRepository)
                    .invalidateAllVerificationCodes(user, VerifyType.EMAIL_VERIFY);
            inOrder.verify(verificationCodeRepository).save(any(VerificationCode.class));
            inOrder.verify(emailService).sendEmail(eq(TestDataFactory.EMAIL), anyString());
        }

        @Test
        @DisplayName("still returns the generic 200 message for an unregistered email")
        void hidesUnregisteredEmail() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            ApiResponse<VerifyEmailResponse> response =
                    verificationCodeService.resendVerification(resendRequest());

            // Enumeration protection: the response must not differ from the registered case, and
            // the internal failure must be swallowed rather than propagated.
            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(RESEND_MESSAGE);
            verify(emailService, never()).sendEmail(anyString(), anyString());
            verify(verificationCodeRepository, never())
                    .invalidateAllVerificationCodes(any(), any());
        }

        @Test
        @DisplayName("sends nothing to an already-verified account, with the same response")
        void skipsVerifiedAccount() {
            user.setEmailVerified(true);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            ApiResponse<VerifyEmailResponse> response =
                    verificationCodeService.resendVerification(resendRequest());

            assertThat(response.getMessage()).isEqualTo(RESEND_MESSAGE);
            verifyNoInteractions(emailService);
            verify(verificationCodeRepository, never()).save(any());
        }

        @Test
        @DisplayName("throws 429 and does no work once the hourly limit is exceeded")
        void throttlesWhenRateLimited() {
            doAnswer(
                            invocation -> {
                                throw new RateLimitExceededException(
                                        invocation.getArgument(3), Duration.ofMinutes(30));
                            })
                    .when(rateLimiterService)
                    .enforce(anyString(), anyInt(), any(), anyString());

            assertThatThrownBy(() -> verificationCodeService.resendVerification(resendRequest()))
                    .isInstanceOf(RateLimitExceededException.class)
                    .hasMessage("Too many verification requests. Please try again later!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

            // A blocked request must not touch the DB, invalidate codes, or send an email.
            verifyNoInteractions(userRepository, emailService);
            verify(verificationCodeRepository, never())
                    .invalidateAllVerificationCodes(any(), any());
        }

        @Test
        @DisplayName("checks the limiter with a lower-cased key and the configured limit/window")
        void usesNormalisedKeyAndConfiguredLimits() {
            when(rateLimitConfig.getMaxRequests()).thenReturn(3);
            when(rateLimitConfig.getWindow()).thenReturn(Duration.ofHours(1));
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            // Mixed-case email must resolve to the same (lower-cased) budget key.
            verificationCodeService.resendVerification(
                    ResendVerificationRequest.builder()
                            .email(TestDataFactory.EMAIL.toUpperCase())
                            .build());

            verify(rateLimiterService)
                    .enforce(
                            eq(
                                    "rate_limit:resend-verification:"
                                            + TestDataFactory.sha256(TestDataFactory.EMAIL)),
                            eq(3),
                            eq(Duration.ofHours(1)),
                            eq("Too many verification requests. Please try again later!"));
        }
    }

    @Nested
    @DisplayName("forgotPassword")
    class ForgotPassword {

        private static final String FORGOT_PASSWORD_MESSAGE =
                "If an account with this email exists, a reset code has been sent.";

        private ForgotPasswordRequest forgotPasswordRequest() {
            return ForgotPasswordRequest.builder().email(TestDataFactory.EMAIL).build();
        }

        @Test
        @DisplayName(
                "invalidates existing PASSWORD_RESET codes then issues and emails a reset code")
        void invalidatesThenReissuesResetLink() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            ApiResponse<Void> response =
                    verificationCodeService.forgotPassword(forgotPasswordRequest());

            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(FORGOT_PASSWORD_MESSAGE);

            // Old codes are invalidated before a new one is persisted/sent, and the reset-link
            // email (not the plain OTP email) is what actually goes out.
            InOrder inOrder = inOrder(verificationCodeRepository, emailService);
            inOrder.verify(verificationCodeRepository)
                    .invalidateAllVerificationCodes(user, VerifyType.PASSWORD_RESET);
            inOrder.verify(verificationCodeRepository).save(any(VerificationCode.class));
            inOrder.verify(emailService)
                    .sendResetPasswordEmail(eq(TestDataFactory.EMAIL), anyString());
            verify(emailService, never()).sendEmail(anyString(), anyString());
        }

        @Test
        @DisplayName("still returns the generic 200 message for an unregistered email")
        void hidesUnregisteredEmail() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            ApiResponse<Void> response =
                    verificationCodeService.forgotPassword(forgotPasswordRequest());

            // Enumeration protection: the response must not differ from the registered case, and
            // no code should ever be generated/emailed for an address that isn't registered.
            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(FORGOT_PASSWORD_MESSAGE);
            verifyNoInteractions(verificationCodeRepository, emailService);
        }

        @Test
        @DisplayName("throws 429 and does no work once the hourly limit is exceeded")
        void throttlesWhenRateLimited() {
            doAnswer(
                            invocation -> {
                                throw new RateLimitExceededException(
                                        invocation.getArgument(3), Duration.ofMinutes(30));
                            })
                    .when(rateLimiterService)
                    .enforce(anyString(), anyInt(), any(), anyString());

            assertThatThrownBy(
                            () -> verificationCodeService.forgotPassword(forgotPasswordRequest()))
                    .isInstanceOf(RateLimitExceededException.class)
                    .hasMessage("Too many forgot password requests. Please try again later!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);

            // A blocked request must not touch the DB, invalidate codes, or send an email.
            verifyNoInteractions(userRepository, verificationCodeRepository, emailService);
        }

        @Test
        @DisplayName("checks the limiter with a lower-cased key and the configured limit/window")
        void usesNormalisedKeyAndConfiguredLimits() {
            when(rateLimitConfig.getMaxRequests()).thenReturn(3);
            when(rateLimitConfig.getWindow()).thenReturn(Duration.ofHours(1));
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            // Mixed-case email must resolve to the same (lower-cased) budget key.
            verificationCodeService.forgotPassword(
                    ForgotPasswordRequest.builder()
                            .email(TestDataFactory.EMAIL.toUpperCase())
                            .build());

            verify(rateLimiterService)
                    .enforce(
                            eq(
                                    "rate_limit:forgot-password:"
                                            + TestDataFactory.sha256(TestDataFactory.EMAIL)),
                            eq(3),
                            eq(Duration.ofHours(1)),
                            eq("Too many forgot password requests. Please try again later!"));
            // ...and the account lookup uses the same normalised address.
            verify(userRepository).findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("swallows an internal failure and still returns the generic message")
        void swallowsInternalFailure() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            when(verificationCodeRepository.save(any(VerificationCode.class)))
                    .thenThrow(new RuntimeException("db unavailable"));

            ApiResponse<Void> response =
                    verificationCodeService.forgotPassword(forgotPasswordRequest());

            // Regression: a persistence failure must not surface as a 500 or leak whether the
            // account exists.
            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(FORGOT_PASSWORD_MESSAGE);
            verify(emailService, never()).sendResetPasswordEmail(anyString(), anyString());
        }
    }
}
