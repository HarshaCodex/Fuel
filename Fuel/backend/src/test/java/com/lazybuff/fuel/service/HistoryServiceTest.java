package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.dto.HistoryDayResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.DailyTotals;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
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
@DisplayName("HistoryService")
class HistoryServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final LocalDate FROM = LocalDate.of(2026, 6, 1);
    private static final LocalDate TO = LocalDate.of(2026, 6, 9);

    @Mock private TrackingEntryRepository trackingEntryRepository;

    @Mock private UserRepository userRepository;

    @Mock private GoalsService goalsService;

    private HistoryService service() {
        return new HistoryService(trackingEntryRepository, userRepository, goalsService);
    }

    private void givenActiveUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID))
                .thenReturn(Optional.of(User.builder().id(USER_ID).build()));
    }

    private void givenGoal(int calories) {
        when(goalsService.getGoals(USER_ID))
                .thenReturn(new GoalsResponse(calories, 150.0, 200.0, 65.0, true, null));
    }

    private void givenRows(LocalDate from, LocalDate to, DailyTotals... rows) {
        when(trackingEntryRepository.findDailyTotals(USER_ID, from, to)).thenReturn(List.of(rows));
    }

    private static DailyTotals row(LocalDate day, String calories, long count) {
        return new DailyTotals(
                day,
                new BigDecimal(calories),
                new BigDecimal("10.5"),
                new BigDecimal("20.25"),
                new BigDecimal("3.1"),
                new BigDecimal("4"),
                count);
    }

    @Test
    @DisplayName("maps the rows to responses and keeps the repository's descending order")
    void shouldMapRowsInOrder() {
        givenActiveUser();
        givenGoal(2200);
        givenRows(FROM, TO, row(TO, "1450.5", 6), row(LocalDate.of(2026, 6, 3), "900", 2));

        ApiResponse<List<HistoryDayResponse>> response = service().get(USER_ID, FROM, TO);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getTimestamp()).isNotNull();
        assertThat(response.getData())
                .containsExactly(
                        new HistoryDayResponse(
                                TO,
                                new BigDecimal("1450.5"),
                                2200,
                                new BigDecimal("10.5"),
                                new BigDecimal("20.25"),
                                new BigDecimal("3.1"),
                                new BigDecimal("4"),
                                6),
                        new HistoryDayResponse(
                                LocalDate.of(2026, 6, 3),
                                new BigDecimal("900"),
                                2200,
                                new BigDecimal("10.5"),
                                new BigDecimal("20.25"),
                                new BigDecimal("3.1"),
                                new BigDecimal("4"),
                                2));
    }

    @Test
    @DisplayName("converts the entry count to an int")
    void shouldConvertEntryCount() {
        givenActiveUser();
        givenGoal(2000);
        givenRows(FROM, TO, row(TO, "100", 12L));

        assertThat(service().get(USER_ID, FROM, TO).getData())
                .extracting(HistoryDayResponse::entryCount)
                .containsExactly(12);
    }

    @Test
    @DisplayName("applies the user's current calorie goal to every row")
    void shouldApplyGoalToEveryRow() {
        givenActiveUser();
        givenGoal(2350);
        givenRows(FROM, TO, row(TO, "1", 1), row(LocalDate.of(2026, 6, 8), "2", 1));

        assertThat(service().get(USER_ID, FROM, TO).getData())
                .extracting(HistoryDayResponse::calorieGoal)
                .containsExactly(2350, 2350);
    }

    @Test
    @DisplayName("passes the default goal through when the user has not saved one")
    void shouldPassDefaultGoalThrough() {
        givenActiveUser();
        when(goalsService.getGoals(USER_ID))
                .thenReturn(new GoalsResponse(2000, 150.0, 200.0, 65.0, false, null));
        givenRows(FROM, TO, row(TO, "1", 1));

        assertThat(service().get(USER_ID, FROM, TO).getData())
                .extracting(HistoryDayResponse::calorieGoal)
                .containsExactly(2000);
    }

    @Test
    @DisplayName("returns an empty list when no day has entries")
    void shouldReturnEmptyListWhenNoEntries() {
        givenActiveUser();
        givenGoal(2200);
        givenRows(FROM, TO);

        ApiResponse<List<HistoryDayResponse>> response = service().get(USER_ID, FROM, TO);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getData()).isEmpty();
    }

    @Test
    @DisplayName("accepts a single-day range")
    void shouldAcceptSameDayRange() {
        givenActiveUser();
        givenGoal(2200);
        givenRows(TO, TO, row(TO, "5", 1));

        assertThat(service().get(USER_ID, TO, TO).getData()).hasSize(1);
    }

    @Test
    @DisplayName("accepts exactly 90 inclusive days")
    void shouldAcceptNinetyInclusiveDays() {
        LocalDate to = FROM.plusDays(89);
        givenActiveUser();
        givenGoal(2200);
        givenRows(FROM, to);

        assertThat(service().get(USER_ID, FROM, to).getData()).isEmpty();
    }

    @Test
    @DisplayName("accepts 90 days that cross a year end and a leap day")
    void shouldCountDaysAcrossYearEndAndLeapDay() {
        LocalDate from = LocalDate.of(2023, 12, 3);
        LocalDate to = LocalDate.of(2024, 3, 1);
        givenActiveUser();
        givenGoal(2200);
        givenRows(from, to);

        // 29 Dec-days (3..31) + 31 Jan + 29 Feb + 1 Mar = 90
        assertThat(service().get(USER_ID, from, to).getData()).isEmpty();
    }

    @Test
    @DisplayName("rejects 91 inclusive days with 400")
    void shouldRejectNinetyOneDays() {
        LocalDate to = FROM.plusDays(90);

        assertThatThrownBy(() -> service().get(USER_ID, FROM, to))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(e.getMessage()).contains("90");
                        });
        verifyNoInteractions(trackingEntryRepository);
    }

    @Test
    @DisplayName("rejects 91 days that cross a leap day")
    void shouldRejectNinetyOneDaysAcrossLeapDay() {
        LocalDate from = LocalDate.of(2023, 12, 2);
        LocalDate to = LocalDate.of(2024, 3, 1);

        assertThatThrownBy(() -> service().get(USER_ID, from, to))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("rejects a to date before from with 400 and never queries")
    void shouldRejectToBeforeFrom() {
        assertThatThrownBy(() -> service().get(USER_ID, TO, FROM))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        verifyNoInteractions(trackingEntryRepository, userRepository, goalsService);
    }

    @Test
    @DisplayName("returns 404 for a deleted user without querying")
    void shouldReturnNotFoundForDeletedUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().get(USER_ID, FROM, TO))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo("User not found");
                        });
        verifyNoInteractions(trackingEntryRepository, goalsService);
    }

    @Test
    @DisplayName("runs exactly one grouped query with the user and range")
    void shouldQueryOnceWithUserAndRange() {
        givenActiveUser();
        givenGoal(2200);
        givenRows(FROM, TO, row(TO, "1", 1), row(FROM, "2", 1));

        service().get(USER_ID, FROM, TO);

        verify(trackingEntryRepository).findDailyTotals(USER_ID, FROM, TO);
        verifyNoMoreInteractions(trackingEntryRepository);
    }
}
