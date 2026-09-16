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
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("EmailService")
class EmailServiceTest {

    private static final String FROM = "noreply@fuel.local";
    private static final String VERIFICATION_SUBJECT = "Verify your email address";
    private static final String FORGOT_PASSWORD_SUBJECT = "Forgot Your Password?";
    private static final String RESET_PASSWORD_BASE_URL =
            "https://app.example.com/reset-password?token=";
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
        ReflectionTestUtils.setField(emailService, "resetPasswordLink", RESET_PASSWORD_BASE_URL);
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
        void swallowsSendFailure() {
            doThrow(new RuntimeException("smtp down"))
                    .when(javaMailSender)
                    .send(any(SimpleMailMessage.class));

            assertThatCode(() -> emailService.sendEmail(TO, CODE)).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("sendResetPasswordEmail")
    class SendResetPasswordEmail {

        @Test
        @DisplayName(
                "sends a message with the forgot-password subject and a link containing the token")
        void sendsResetLinkEmail() {
            emailService.sendResetPasswordEmail(TO, CODE);

            verify(javaMailSender).send(messageCaptor.capture());
            SimpleMailMessage sent = messageCaptor.getValue();

            assertThat(sent.getFrom()).isEqualTo(FROM);
            assertThat(sent.getTo()).containsExactly(TO);
            assertThat(sent.getSubject()).isEqualTo(FORGOT_PASSWORD_SUBJECT);
            // Regression: the email must contain an actual link with the raw token, not the bare
            // code, and must never reuse the email-verification subject/wording.
            assertThat(sent.getText()).contains(RESET_PASSWORD_BASE_URL + CODE);
            assertThat(sent.getSubject()).isNotEqualTo(VERIFICATION_SUBJECT);
        }

        @Test
        @DisplayName("swallows a mail-sending failure instead of propagating it")
        void swallowsSendFailure() {
            doThrow(new RuntimeException("smtp down"))
                    .when(javaMailSender)
                    .send(any(SimpleMailMessage.class));

            assertThatCode(() -> emailService.sendResetPasswordEmail(TO, CODE))
                    .doesNotThrowAnyException();
        }
    }
}
