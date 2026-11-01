package com.lazybuff.fuel.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.AccountDeletionConfig;
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
@DisplayName("DeletedAccountPurge")
class DeletedAccountPurgeTest {

    @Mock private UserRepository userRepository;
    @Mock private FoodItemRepository foodItemRepository;

    private DeletedAccountPurge purge;

    @BeforeEach
    void setUp() {
        purge =
                new DeletedAccountPurge(
                        userRepository, foodItemRepository, new AccountDeletionConfig());
    }

    @Test
    @DisplayName("purges accounts deleted more than the retention period ago")
    void shouldPurgeAccountsPastRetention() {
        when(foodItemRepository.deleteCustomFoodsOfUsersDeletedBefore(any())).thenReturn(2);
        when(userRepository.purgeDeletedBefore(any())).thenReturn(1);

        Instant before = Instant.now();
        purge.purgeDeletedAccounts();

        ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
        InOrder order = inOrder(foodItemRepository, userRepository);
        // Custom foods first: once the users are gone, the foods can no longer be traced to them.
        order.verify(foodItemRepository).deleteCustomFoodsOfUsersDeletedBefore(cutoff.capture());
        order.verify(userRepository).purgeDeletedBefore(cutoff.getValue());
        assertThat(cutoff.getValue())
                .isBetween(
                        before.minus(Duration.ofDays(30)),
                        Instant.now().minus(Duration.ofDays(30)));
    }
}
