package com.lazybuff.fuel.scheduler;

import com.lazybuff.fuel.config.AccountDeletionConfig;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Permanently erases accounts once their post-deletion grace period has passed (GDPR right to
 * erasure). Until then a deleted account is only soft-deleted.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeletedAccountPurge {

    private final UserRepository userRepository;

    private final FoodItemRepository foodItemRepository;

    private final AccountDeletionConfig accountDeletionConfig;

    @Scheduled(cron = "${app.account-deletion.purge-cron}")
    @Transactional
    public void purgeDeletedAccounts() {
        Instant cutoff = Instant.now().minus(accountDeletionConfig.getRetention());

        int foods = foodItemRepository.deleteCustomFoodsOfUsersDeletedBefore(cutoff);
        int users = userRepository.purgeDeletedBefore(cutoff);

        log.info("Purged {} deleted accounts and {} of their custom foods", users, foods);
    }
}
