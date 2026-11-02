package com.lazybuff.fuel.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender javaMailSender;

    @Value("${app.mail.from-email-address}")
    private String fromEmailAddress;

    @Value("${app.mail.verification-subject}")
    private String verificationEmailSubject;

    @Value("${app.mail.forgot-password-subject}")
    private String forgotPasswordEmailSubject;

    @Value("${app.mail.account-exists-subject}")
    private String accountExistsEmailSubject;

    @Async("emailTaskExecutor")
    public void sendEmail(String to, String verificationCode) {

        try {

            SimpleMailMessage message = new SimpleMailMessage();

            message.setFrom(fromEmailAddress);
            message.setTo(to);
            message.setSubject(verificationEmailSubject);
            message.setText("Your verification code is: " + verificationCode);

            javaMailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send verification email, ex", e);
        }
    }

    @Async("emailTaskExecutor")
    public void sendResetPasswordEmail(String to, String verificationCode) {

        try {

            SimpleMailMessage message = new SimpleMailMessage();

            message.setFrom(fromEmailAddress);
            message.setTo(to);
            message.setSubject(forgotPasswordEmailSubject);
            // The code itself, not a link: codes in URLs end up in browser history and server
            // logs, and the app's reset screen takes the code directly (#88).
            message.setText(
                    "Your password reset code is: "
                            + verificationCode
                            + "\n\nEnter it in the Fuel app within 15 minutes. If you didn't ask"
                            + " to reset your password, you can ignore this email.");

            javaMailSender.send(message);

        } catch (Exception e) {
            log.error("Failed to send password reset email, ex", e);
        }
    }

    /** Sent when someone tries to register with an email that already has an account (#86). */
    @Async("emailTaskExecutor")
    public void sendAccountExistsEmail(String to) {

        try {

            SimpleMailMessage message = new SimpleMailMessage();

            message.setFrom(fromEmailAddress);
            message.setTo(to);
            message.setSubject(accountExistsEmailSubject);
            message.setText(
                    "Someone tried to create a Fuel account with this email address, but you"
                            + " already have one.\n\n"
                            + "If this was you, log in instead. If you've forgotten your password,"
                            + " use \"Forgot password\" in the app to reset it.\n\n"
                            + "If it wasn't you, you can ignore this email; your account hasn't"
                            + " changed.");

            javaMailSender.send(message);

        } catch (Exception e) {
            log.error("Failed to send account-exists email: {}", e.getClass().getSimpleName());
        }
    }
}
