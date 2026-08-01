package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.repository.VerificationCodeRepository;
import com.lazybuff.fuel.util.TokenHasher;
import com.lazybuff.fuel.util.VerifyType;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class VerificationCodeService {

    private final VerificationCodeRepository verificationCodeRepository;

    @NoLogging
    public String generateVerificationCode(User user) throws NoSuchAlgorithmException {

        SecureRandom secureRandom = new SecureRandom();
        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 5; i++) {
            code.append(secureRandom.nextInt(5));
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

        return code.toString();
    }
}
