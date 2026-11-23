package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.StreakResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("StreakService")
class StreakServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    // 18:00 UTC is 23:30 in Asia/Kolkata on 5 Nov; 19:00 UTC is 00:30 on 6 Nov.
    private static final Instant BEFORE_MIDNIGHT_IST = Instant.parse("2026-11-05T18:00:00Z");
    private static final Instant AFTER_MIDNIGHT_IST = Instant.parse("2026-11-05T19:00:00Z");

    @Mock private TrackingEntryRepository trackingEntryRepository;

    @Mock private UserRepository userRepository;

    private StreakService service(Instant now) {
        return new StreakService(
                trackingEntryRepository, userRepository, Clock.fixed(now, ZoneOffset.UTC));
    }

    private void givenUser(String timezone) {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID))
                .thenReturn(Optional.of(User.builder().id(USER_ID).timezone(timezone).build()));
    }

    @Test
    @DisplayName("uses the user's local date just before local midnight")
    void shouldUseLocalTodayBeforeMidnight() {
        givenUser("Asia/Kolkata");
        LocalDate today = LocalDate.of(2026, 11, 5);
        when(trackingEntryRepository.findDistinctLogDates(USER_ID, today))
                .thenReturn(List.of(today));

        ApiResponse<StreakResponse> response = service(BEFORE_MIDNIGHT_IST).get(USER_ID);

        assertThat(response.getData()).isEqualTo(new StreakResponse(1, 1, today));
    }

    @Test
    @DisplayName("moves to the next local date just after local midnight, keeping the streak")
    void shouldUseNextLocalTodayAfterMidnight() {
        givenUser("Asia/Kolkata");
        LocalDate logged = LocalDate.of(2026, 11, 5);
        when(trackingEntryRepository.findDistinctLogDates(USER_ID, LocalDate.of(2026, 11, 6)))
                .thenReturn(List.of(logged));

        ApiResponse<StreakResponse> response = service(AFTER_MIDNIGHT_IST).get(USER_ID);

        assertThat(response.getData()).isEqualTo(new StreakResponse(1, 1, logged));
    }

    @Test
    @DisplayName("falls back to UTC when the stored timezone is invalid")
    void shouldFallBackToUtcForInvalidTimezone() {
        givenUser("Not/AZone");
        when(trackingEntryRepository.findDistinctLogDates(USER_ID, LocalDate.of(2026, 11, 5)))
                .thenReturn(List.of());

        ApiResponse<StreakResponse> response = service(BEFORE_MIDNIGHT_IST).get(USER_ID);

        assertThat(response.getData()).isEqualTo(new StreakResponse(0, 0, null));
    }

    @Test
    @DisplayName("returns an empty streak with a success envelope when nothing is logged")
    void shouldReturnEmptyStreakEnvelope() {
        givenUser("UTC");
        when(trackingEntryRepository.findDistinctLogDates(USER_ID, LocalDate.of(2026, 11, 5)))
                .thenReturn(List.of());

        ApiResponse<StreakResponse> response = service(BEFORE_MIDNIGHT_IST).get(USER_ID);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getData().lastLoggedDate()).isNull();
    }

    @Test
    @DisplayName("throws 404 for a deleted or unknown user")
    void shouldThrowNotFoundForDeletedUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service(BEFORE_MIDNIGHT_IST).get(USER_ID))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(trackingEntryRepository);
    }
}
