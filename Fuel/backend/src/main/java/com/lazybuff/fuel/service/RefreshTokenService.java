package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.entity.RefreshToken;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.RefreshTokenRepository;
import com.lazybuff.fuel.util.TokenHasher;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
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

    /**
     * Redeems a raw refresh token: single-use rotation with replay detection. Deletes the token row
     * on every outcome so a rotated-out or reused hash is never left behind.
     *
     * @param callerUserId the id of the user resolved from an already-authenticated caller (e.g. a
     *     still-valid access token), if any; used only to scope the replay response, never to
     *     decide whose token gets rotated.
     * @return the owner of the redeemed token, to issue new tokens for.
     * @throws FuelException with 401 if the token is unknown (possible replay) or expired.
     */
    @Transactional
    public User rotate(String rawToken, UUID callerUserId) throws NoSuchAlgorithmException {
        String tokenHash = TokenHasher.sha256Hex(rawToken);

        Optional<RefreshToken> refreshToken = refreshTokenRepository.findByTokenHash(tokenHash);

        if (refreshToken.isEmpty()) {
            // The hash isn't found because it was already rotated out and deleted - reusing it is
            // a replay signal, so invalidate every session for the resolvable user.
            if (callerUserId != null) {
                revokeAll(callerUserId);
            }
            throw new FuelException(
                    HttpStatus.UNAUTHORIZED, "Refresh token invalid, expired or revoked");
        }

        RefreshToken token = refreshToken.get();

        if (token.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.deleteByTokenHash(tokenHash);
            throw new FuelException(
                    HttpStatus.UNAUTHORIZED, "Refresh token invalid, expired or revoked");
        }

        refreshTokenRepository.deleteByTokenHash(tokenHash);
        return token.getUser();
    }
}
