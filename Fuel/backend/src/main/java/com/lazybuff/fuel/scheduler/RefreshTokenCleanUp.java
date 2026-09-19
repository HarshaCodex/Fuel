package com.lazybuff.fuel.scheduler;

import com.lazybuff.fuel.repository.RefreshTokenRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenCleanUp {

    private final RefreshTokenRepository refreshTokenRepository;

    @Scheduled(cron = "${refresh-token.scheduler.cleanup.cron}")
    @Transactional
    public void refreshTokenCleanup() {
        log.info("Cleaning up refresh tokens that are expired");
        refreshTokenRepository.deleteByExpiresAtBefore(Instant.now());
    }
}
