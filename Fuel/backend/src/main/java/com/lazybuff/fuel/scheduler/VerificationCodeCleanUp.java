package com.lazybuff.fuel.scheduler;

import com.lazybuff.fuel.repository.VerificationCodeRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes verification and reset codes that can't be used any more (#90), so they aren't kept until
 * the account itself is deleted.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VerificationCodeCleanUp {

    private final VerificationCodeRepository verificationCodeRepository;

    @Scheduled(cron = "${app.verification-code.cleanup-cron}")
    @Transactional
    public void deleteUnusableCodes() {
        int deleted = verificationCodeRepository.deleteUsedOrExpired(Instant.now());
        log.info("Deleted {} used or expired verification codes", deleted);
    }
}
