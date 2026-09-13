package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.entity.RefreshToken;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.repository.RefreshTokenRepository;
import com.lazybuff.fuel.util.TokenHasher;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    private final JwtConfig jwtConfig;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @NoLogging
    public String issueRefreshToken(User user, String deviceInfo, String ipAddress)
            throws Exception {
        try {
            byte[] bytes = new byte[32];
            SECURE_RANDOM.nextBytes(bytes);
            String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

            refreshTokenRepository.save(
                    RefreshToken.builder()
                            .user(user)
                            .tokenHash(TokenHasher.sha256Hex(raw))
                            .expiresAt(
                                    Instant.now()
                                            .plusSeconds(jwtConfig.getRefreshTokenExpirySeconds()))
                            .deviceInfo(deviceInfo)
                            .ipAddress(ipAddress)
                            .build());

            return raw;
        } catch (Exception e) {
            log.error("Exception while refreshing token: ", e);
            throw e;
        }
    }

    @Transactional
    public void revoke(String rawToken) throws NoSuchAlgorithmException {
        refreshTokenRepository.deleteByTokenHash(TokenHasher.sha256Hex(rawToken));
    }

    @Transactional
    public void revokeForUser(String rawToken, UUID userId) throws NoSuchAlgorithmException {
        refreshTokenRepository.deleteByTokenHashAndUser_Id(TokenHasher.sha256Hex(rawToken), userId);
    }

    @Transactional
    public void revokeAll(UUID userId) {
        refreshTokenRepository.deleteByUser_Id(userId);
    }
}
