package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.RecentFoodItem;
import com.lazybuff.fuel.repository.RecentFood;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecentFoodService")
class RecentFoodServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private TrackingEntryRepository trackingEntryRepository;

    @InjectMocks private RecentFoodService service;

    @Test
    @DisplayName("maps fields, lowercasing the unit and using the source name")
    void shouldMapFields() {
        UUID id = UUID.randomUUID();
        OffsetDateTime at = OffsetDateTime.parse("2026-01-10T12:00:00Z");
        when(trackingEntryRepository.findRecentFoods(any(), any()))
                .thenReturn(
                        List.of(
                                new RecentFood(
                                        id,
                                        "Oats",
                                        "Quaker",
                                        FoodSource.OFF,
                                        new BigDecimal("40"),
                                        ServingUnit.TBSP,
                                        new BigDecimal("150"),
                                        new BigDecimal("5"),
                                        new BigDecimal("27"),
                                        new BigDecimal("3"),
                                        at)));

        ApiResponse<List<RecentFoodItem>> response = service.recent(USER_ID, 10);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getData())
                .containsExactly(
                        new RecentFoodItem(
                                id,
                                "Oats",
                                "Quaker",
                                "OFF",
                                new BigDecimal("40"),
                                "tbsp",
                                new BigDecimal("150"),
                                new BigDecimal("5"),
                                new BigDecimal("27"),
                                new BigDecimal("3"),
                                at));
    }

    @Test
    @DisplayName("returns an empty list, not null, when nothing was logged")
    void shouldReturnEmptyListWhenNothingLogged() {
        when(trackingEntryRepository.findRecentFoods(any(), any())).thenReturn(List.of());

        assertThat(service.recent(USER_ID, 10).getData()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("queries for the caller with the limit as the page size")
    void shouldPassUserAndLimitAsPageSize() {
        when(trackingEntryRepository.findRecentFoods(any(), any())).thenReturn(List.of());

        service.recent(USER_ID, 17);

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(trackingEntryRepository)
                .findRecentFoods(org.mockito.ArgumentMatchers.eq(USER_ID), page.capture());
        assertThat(page.getValue().getPageNumber()).isZero();
        assertThat(page.getValue().getPageSize()).isEqualTo(17);
    }

    @Test
    @DisplayName("rethrows repository failures")
    void shouldRethrowRepositoryFailure() {
        when(trackingEntryRepository.findRecentFoods(any(), any()))
                .thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> service.recent(USER_ID, 10))
                .isInstanceOf(IllegalStateException.class);
    }
}
