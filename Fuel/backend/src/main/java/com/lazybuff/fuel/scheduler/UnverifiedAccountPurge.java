package com.lazybuff.fuel.scheduler;

import com.lazybuff.fuel.config.UnverifiedAccountConfig;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Permanently erases email/password sign-ups that were never verified (#89). Anyone can register an
 * address they don't own; without this the row, with the name they gave, would stay forever.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UnverifiedAccountPurge {

    private final UserRepository userRepository;

    private final FoodItemRepository foodItemRepository;

    private final UnverifiedAccountConfig unverifiedAccountConfig;

    @Scheduled(cron = "${app.unverified-account.purge-cron}")
    @Transactional
    public void purgeUnverifiedAccounts() {
        Instant cutoff = Instant.now().minus(unverifiedAccountConfig.getRetention());

        int foods = foodItemRepository.deleteCustomFoodsOfUnverifiedUsersCreatedBefore(cutoff);
        int users = userRepository.purgeUnverifiedCreatedBefore(cutoff);

        log.info("Purged {} unverified accounts and {} of their custom foods", users, foods);
    }
}
