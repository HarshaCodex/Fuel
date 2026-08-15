package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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
                        rateLimitConfig);
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
                        TestDataFactory.sha256(TestDataFactory.VALID_CODE)))
                .thenReturn(result);
    }

    @Nested
    @DisplayName("generateVerificationCode")
    class GenerateVerificationCode {

        @Test
        @DisplayName("persists an unused EMAIL_VERIFY code hashed with a ~24h expiry")
        void persistsHashedCode() throws Exception {
            String returned = verificationCodeService.generateVerificationCode(user);

            verify(verificationCodeRepository).save(codeCaptor.capture());
            VerificationCode saved = codeCaptor.getValue();

            assertThat(saved.getUser()).isSameAs(user);
            assertThat(saved.getType()).isEqualTo(VerifyType.EMAIL_VERIFY);
            assertThat(saved.getUsedAt()).isNull();
            // Only the hash is stored, never the raw code.
            assertThat(saved.getCodeHash()).isEqualTo(TestDataFactory.sha256(returned));
            assertThat(saved.getCodeHash()).isNotEqualTo(returned);
            assertThat(saved.getExpires_at())
                    .isBetween(
                            Instant.now().plusSeconds(23 * 3600),
                            Instant.now().plusSeconds(25 * 3600));
        }

        @Test
        @DisplayName("emails the raw code to the user after the code is persisted")
        void emailsRawCodeAfterPersisting() throws Exception {
            String returned = verificationCodeService.generateVerificationCode(user);

            verify(emailService).sendEmail(eq(TestDataFactory.EMAIL), emailedCodeCaptor.capture());
            assertThat(emailedCodeCaptor.getValue()).isEqualTo(returned);

            // Regression (#6): the code must be persisted before the email goes out, otherwise a
            // save failure would leave the user holding a code that can never verify.
            InOrder inOrder = inOrder(verificationCodeRepository, emailService);
            inOrder.verify(verificationCodeRepository).save(any(VerificationCode.class));
            inOrder.verify(emailService).sendEmail(anyString(), anyString());
        }

        @Test
        @DisplayName("returns a 5-digit numeric code")
        void returnsFiveDigitNumericCode() throws Exception {
            String code = verificationCodeService.generateVerificationCode(user);

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
                        verificationCodeService.generateVerificationCode(user).toCharArray()) {
                    seen.add(c);
                }
            }

            for (char digit = '0'; digit <= '9'; digit++) {
                assertThat(seen).contains(digit);
            }
        }
    }

    @Nested
    @DisplayName("verifyEmail - success")
    class VerifyEmailSuccess {

        @Test
        @DisplayName("marks the code used, flips emailVerified, and returns a 200 response")
        void verifiesValidCode() throws Exception {
            VerificationCode code = TestDataFactory.validVerificationCode(user);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);
            stubCodeLookup(Optional.of(code));

            ApiResponse<VerifyEmailResponse> response =
                    verificationCodeService.verifyEmail(verifyRequest(TestDataFactory.VALID_CODE));

            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo("Email verified successfully");
            assertThat(response.getData().isEmailVerified()).isTrue();

            assertThat(user.isEmailVerified()).isTrue();
            assertThat(code.getUsedAt()).isNotNull();
            verifyNoInteractions(emailService);
        }
    }

    @Nested
    @DisplayName("verifyEmail - failures")
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
                                    verificationCodeService.verifyEmail(
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
                                    verificationCodeService.verifyEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);

            assertThat(user.isEmailVerified()).isFalse();
            assertThat(expired.getUsedAt()).isNull();
        }

        @Test
        @DisplayName("throws 401 (not NPE/500) when the email is not registered")
        void rejectsUnknownEmailWithoutNpe() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.verifyEmail(
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
        @DisplayName("throws 409 CONFLICT when the email is already verified")
        void rejectsAlreadyVerifiedEmail() {
            user.setEmailVerified(true);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(user);

            assertThatThrownBy(
                            () ->
                                    verificationCodeService.verifyEmail(
                                            verifyRequest(TestDataFactory.VALID_CODE)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Email already verified")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(HttpStatus.CONFLICT);

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

        /** The rate limiter permits the call; the vast majority of resends are within budget. */
        private void stubWithinRateLimit() {
            when(rateLimiterService.isAllowed(anyString(), anyInt(), any())).thenReturn(true);
        }

        @Test
        @DisplayName("invalidates existing codes then issues and emails a fresh one")
        void invalidatesThenReissues() {
            stubWithinRateLimit();
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
            stubWithinRateLimit();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            ApiResponse<VerifyEmailResponse> response =
                    verificationCodeService.resendVerification(resendRequest());

            // Enumeration protection: the response must not differ from the registered case, and
            // the internal failure must be swallowed rather than propagated.
            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo(RESEND_MESSAGE);
            verify(emailService, never()).sendEmail(anyString(), anyString());
        }

        @Test
        @DisplayName("throws 429 and does no work once the hourly limit is exceeded")
        void throttlesWhenRateLimited() {
            when(rateLimiterService.isAllowed(anyString(), anyInt(), any())).thenReturn(false);

            assertThatThrownBy(() -> verificationCodeService.resendVerification(resendRequest()))
                    .isInstanceOf(FuelException.class)
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
            when(rateLimiterService.isAllowed(anyString(), anyInt(), any())).thenReturn(true);
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
                    .isAllowed(
                            eq("rate_limit:resend-verification:" + TestDataFactory.EMAIL),
                            eq(3),
                            eq(Duration.ofHours(1)));
        }
    }
}
