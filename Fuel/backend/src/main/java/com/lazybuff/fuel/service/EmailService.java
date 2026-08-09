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
            log.error("Failed to send email to {}, ex", to, e);
        }
    }
}
