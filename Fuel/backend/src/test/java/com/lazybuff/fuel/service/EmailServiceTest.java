package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
@DisplayName("EmailService")
class EmailServiceTest {

    private static final String FROM = "noreply@fuel.local";
    private static final String VERIFICATION_SUBJECT = "Verify your email address";
    private static final String FORGOT_PASSWORD_SUBJECT = "Forgot Your Password?";
    private static final String ACCOUNT_EXISTS_SUBJECT = "You already have a Fuel account";
    private static final String TO = "john.doe@example.com";
    private static final String CODE = "12345";

    @Mock private JavaMailSender javaMailSender;

    private EmailService emailService;

    @Captor private ArgumentCaptor<SimpleMailMessage> messageCaptor;

    @BeforeEach
    void setUp() {
        emailService = new EmailService(javaMailSender);
        ReflectionTestUtils.setField(emailService, "fromEmailAddress", FROM);
        ReflectionTestUtils.setField(
                emailService, "verificationEmailSubject", VERIFICATION_SUBJECT);
        ReflectionTestUtils.setField(
                emailService, "forgotPasswordEmailSubject", FORGOT_PASSWORD_SUBJECT);
        ReflectionTestUtils.setField(
                emailService, "accountExistsEmailSubject", ACCOUNT_EXISTS_SUBJECT);
    }

    @Nested
    @DisplayName("sendEmail")
    class SendEmail {

        @Test
        @DisplayName("sends a message with the verification subject and the raw code in the body")
        void sendsVerificationCodeEmail() {
            emailService.sendEmail(TO, CODE);

            verify(javaMailSender).send(messageCaptor.capture());
            SimpleMailMessage sent = messageCaptor.getValue();

            assertThat(sent.getFrom()).isEqualTo(FROM);
            assertThat(sent.getTo()).containsExactly(TO);
            assertThat(sent.getSubject()).isEqualTo(VERIFICATION_SUBJECT);
            assertThat(sent.getText()).isEqualTo("Your verification code is: " + CODE);
        }

        @Test
        @DisplayName("swallows a mail-sending failure instead of propagating it")
        void swallowsSendFailure(CapturedOutput output) {
            doThrow(new RuntimeException("smtp down"))
                    .when(javaMailSender)
                    .send(any(SimpleMailMessage.class));

            assertThatCode(() -> emailService.sendEmail(TO, CODE)).doesNotThrowAnyException();
            // Regression (#84): the failure log must not expose the address or the code.
            assertThat(output).contains("Failed to send verification email");
            assertThat(output).doesNotContain(TO).doesNotContain(CODE);
        }
    }

    @Nested
    @DisplayName("sendResetPasswordEmail")
    class SendResetPasswordEmail {

        @Test
        @DisplayName("sends the code itself with the forgot-password subject, not a link")
        void sendsResetCodeEmail() {
            emailService.sendResetPasswordEmail(TO, CODE);

            verify(javaMailSender).send(messageCaptor.capture());
            SimpleMailMessage sent = messageCaptor.getValue();

            assertThat(sent.getFrom()).isEqualTo(FROM);
            assertThat(sent.getTo()).containsExactly(TO);
            assertThat(sent.getSubject()).isEqualTo(FORGOT_PASSWORD_SUBJECT);
            // A code in a URL would end up in browser history and server logs (#88).
            assertThat(sent.getText()).contains("Your password reset code is: " + CODE);
            assertThat(sent.getText()).doesNotContain("http");
            assertThat(sent.getSubject()).isNotEqualTo(VERIFICATION_SUBJECT);
        }

        @Test
        @DisplayName("swallows a mail-sending failure instead of propagating it")
        void swallowsSendFailure(CapturedOutput output) {
            doThrow(new RuntimeException("smtp down"))
                    .when(javaMailSender)
                    .send(any(SimpleMailMessage.class));

            assertThatCode(() -> emailService.sendResetPasswordEmail(TO, CODE))
                    .doesNotThrowAnyException();
            assertThat(output).contains("Failed to send password reset email");
            assertThat(output).doesNotContain(TO).doesNotContain(CODE);
        }
    }

    @Nested
    @DisplayName("sendAccountExistsEmail")
    class SendAccountExistsEmail {

        @Test
        @DisplayName("tells the owner to log in or reset their password")
        void sendsAccountExistsEmail() {
            emailService.sendAccountExistsEmail(TO);

            verify(javaMailSender).send(messageCaptor.capture());
            SimpleMailMessage sent = messageCaptor.getValue();

            assertThat(sent.getFrom()).isEqualTo(FROM);
            assertThat(sent.getTo()).containsExactly(TO);
            assertThat(sent.getSubject()).isEqualTo(ACCOUNT_EXISTS_SUBJECT);
            assertThat(sent.getText()).contains("already have one").contains("Forgot password");
        }

        @Test
        @DisplayName("swallows a mail-sending failure without logging the address")
        void swallowsSendFailure(CapturedOutput output) {
            doThrow(new RuntimeException("smtp down for " + TO))
                    .when(javaMailSender)
                    .send(any(SimpleMailMessage.class));

            assertThatCode(() -> emailService.sendAccountExistsEmail(TO))
                    .doesNotThrowAnyException();
            assertThat(output).contains("Failed to send account-exists email").doesNotContain(TO);
        }
    }
}
