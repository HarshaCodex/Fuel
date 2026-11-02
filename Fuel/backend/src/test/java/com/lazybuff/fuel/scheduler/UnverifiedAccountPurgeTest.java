package com.lazybuff.fuel.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.UnverifiedAccountConfig;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("UnverifiedAccountPurge")
class UnverifiedAccountPurgeTest {

    @Mock private UserRepository userRepository;
    @Mock private FoodItemRepository foodItemRepository;

    private UnverifiedAccountPurge purge;

    @BeforeEach
    void setUp() {
        purge =
                new UnverifiedAccountPurge(
                        userRepository, foodItemRepository, new UnverifiedAccountConfig());
    }

    @Test
    @DisplayName("purges unverified accounts created more than the retention period ago")
    void shouldPurgeUnverifiedAccountsPastRetention() {
        when(foodItemRepository.deleteCustomFoodsOfUnverifiedUsersCreatedBefore(any()))
                .thenReturn(0);
        when(userRepository.purgeUnverifiedCreatedBefore(any())).thenReturn(3);

        Instant before = Instant.now();
        purge.purgeUnverifiedAccounts();

        ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
        InOrder order = inOrder(foodItemRepository, userRepository);
        // Custom foods first: once the users are gone, the foods can no longer be traced to them.
        order.verify(foodItemRepository)
                .deleteCustomFoodsOfUnverifiedUsersCreatedBefore(cutoff.capture());
        order.verify(userRepository).purgeUnverifiedCreatedBefore(cutoff.getValue());
        assertThat(cutoff.getValue())
                .isBetween(
                        before.minus(Duration.ofDays(7)), Instant.now().minus(Duration.ofDays(7)));
    }
}
