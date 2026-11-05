package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DashboardResponse;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.dto.StreakResponse;
import com.lazybuff.fuel.entity.TrackingEntry;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.FoodSource;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
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
@DisplayName("DashboardService")
class DashboardServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    // 18:00 UTC is 23:30 on 5 Nov in Asia/Kolkata but still 5 Nov in UTC; 19:00 UTC is 6 Nov in
    // IST.
    private static final Instant NOW = Instant.parse("2026-11-05T19:00:00Z");
    private static final LocalDate UTC_TODAY = LocalDate.of(2026, 11, 5);
    private static final LocalDate IST_TODAY = LocalDate.of(2026, 11, 6);
    private static final StreakResponse STREAK = new StreakResponse(2, 4, UTC_TODAY);

    @Mock private TrackingEntryRepository trackingEntryRepository;

    @Mock private UserRepository userRepository;

    @Mock private GoalsService goalsService;

    @Mock private StreakService streakService;

    private DashboardService service() {
        return new DashboardService(
                trackingEntryRepository,
                userRepository,
                goalsService,
                streakService,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private User givenUser(String timezone) {
        User user = User.builder().id(USER_ID).timezone(timezone).build();
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(streakService.streakFor(user)).thenReturn(STREAK);
        return user;
    }

    private void givenGoals(int calories, double protein, double carbs, double fat) {
        when(goalsService.getGoals(USER_ID))
                .thenReturn(new GoalsResponse(calories, protein, carbs, fat, true, null));
    }

    private void givenEntries(LocalDate day, TrackingEntry... entries) {
        when(trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                        USER_ID, day))
                .thenReturn(List.of(entries));
    }

    private static TrackingEntry entry(
            String name, String calories, String protein, String carbs, String fat, String at) {
        return TrackingEntry.builder()
                .id(UUID.randomUUID())
                .foodName(name)
                .foodSource(FoodSource.USDA)
                .mealLabel("lunch")
                .calories(new BigDecimal(calories))
                .protein(new BigDecimal(protein))
                .carbs(new BigDecimal(carbs))
                .fat(new BigDecimal(fat))
                .loggedAt(OffsetDateTime.parse(at))
                .build();
    }

    private DashboardResponse dashboardFor(LocalDate date) {
        ApiResponse<DashboardResponse> response = service().get(USER_ID, date);
        return response.getData();
    }

    @Test
    @DisplayName("totals equal the sum of the day's entries without rounding drift")
    void shouldSumEntryValuesExactly() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(
                UTC_TODAY,
                entry("A", "100.1", "0.1", "0.1", "0.01", "2026-11-05T08:00:00Z"),
                entry("B", "200.2", "0.2", "0.2", "0.02", "2026-11-05T12:00:00Z"));

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.calories().consumed()).isEqualByComparingTo("300.3");
        assertThat(body.macros().protein().consumed()).isEqualByComparingTo("0.3");
        assertThat(body.macros().carbs().consumed()).isEqualByComparingTo("0.3");
        assertThat(body.macros().fat().consumed()).isEqualByComparingTo("0.03");
    }

    @Test
    @DisplayName(
            "only the entries the repository returns are counted, so deleted ones are excluded")
    void shouldCountOnlyEntriesReturnedByRepository() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(UTC_TODAY, entry("Kept", "50.0", "1.0", "2.0", "3.0", "2026-11-05T08:00:00Z"));

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.entries())
                .extracting(DashboardResponse.DashboardEntry::foodName)
                .containsExactly("Kept");
        assertThat(body.calories().consumed()).isEqualByComparingTo("50.0");
    }

    @Test
    @DisplayName("passes the goals through with the macro unit in grams")
    void shouldPassGoalsThrough() {
        givenUser("UTC");
        givenGoals(1800, 120.5, 210.0, 55.5);
        givenEntries(UTC_TODAY);

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.calories().goal()).isEqualTo(1800);
        assertThat(body.macros().protein().goal()).isEqualTo(120.5);
        assertThat(body.macros().carbs().goal()).isEqualTo(210.0);
        assertThat(body.macros().fat().goal()).isEqualTo(55.5);
        assertThat(body.macros().protein().unit()).isEqualTo("g");
        assertThat(body.macros().carbs().unit()).isEqualTo("g");
        assertThat(body.macros().fat().unit()).isEqualTo("g");
    }

    @Test
    @DisplayName("remaining calories go negative when the user is over the goal")
    void shouldReturnNegativeRemainingWhenOverGoal() {
        givenUser("UTC");
        givenGoals(500, 150, 200, 65);
        givenEntries(UTC_TODAY, entry("Big", "650.5", "1", "1", "1", "2026-11-05T08:00:00Z"));

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.calories().remaining()).isEqualByComparingTo("-150.5");
    }

    @Test
    @DisplayName("remaining calories equal the goal minus consumed")
    void shouldReturnGoalMinusConsumedAsRemaining() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(UTC_TODAY, entry("A", "400.5", "1", "1", "1", "2026-11-05T08:00:00Z"));

        assertThat(dashboardFor(UTC_TODAY).calories().remaining()).isEqualByComparingTo("1599.5");
    }

    @Test
    @DisplayName("an empty day gives zero totals, no entries and the full goal")
    void shouldReturnZerosForEmptyDay() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(UTC_TODAY);

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.entries()).isEmpty();
        assertThat(body.calories().consumed()).isEqualByComparingTo("0");
        assertThat(body.calories().remaining()).isEqualByComparingTo("2000");
        assertThat(body.calories().goal()).isEqualTo(2000);
        assertThat(body.macros().protein().consumed()).isEqualByComparingTo("0");
        assertThat(body.macros().carbs().consumed()).isEqualByComparingTo("0");
        assertThat(body.macros().fat().consumed()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("defaults the date to today in the user's timezone, ahead of UTC")
    void shouldDefaultToUsersLocalToday() {
        givenUser("Asia/Kolkata");
        givenGoals(2000, 150, 200, 65);
        givenEntries(IST_TODAY);

        DashboardResponse body = dashboardFor(null);

        assertThat(body.date()).isEqualTo(IST_TODAY);
    }

    @Test
    @DisplayName("defaults the date to the UTC day when the timezone is invalid")
    void shouldDefaultToUtcTodayForInvalidTimezone() {
        givenUser("Not/AZone");
        givenGoals(2000, 150, 200, 65);
        givenEntries(UTC_TODAY);

        assertThat(dashboardFor(null).date()).isEqualTo(UTC_TODAY);
    }

    @Test
    @DisplayName("uses an explicit date as given, even in the future")
    void shouldUseExplicitDateAsGiven() {
        LocalDate requested = LocalDate.of(2030, 1, 1);
        givenUser("Asia/Kolkata");
        givenGoals(2000, 150, 200, 65);
        givenEntries(requested);

        DashboardResponse body = dashboardFor(requested);

        assertThat(body.date()).isEqualTo(requested);
        assertThat(body.entries()).isEmpty();
    }

    @Test
    @DisplayName("keeps the repository's entry order and maps entry fields")
    void shouldPreserveEntryOrderAndMapFields() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        TrackingEntry first = entry("First", "10.0", "1.0", "2.0", "3.0", "2026-11-05T07:00:00Z");
        TrackingEntry second = entry("Second", "20.0", "4.0", "5.0", "6.0", "2026-11-05T09:00:00Z");
        givenEntries(UTC_TODAY, first, second);

        DashboardResponse body = dashboardFor(UTC_TODAY);

        assertThat(body.entries())
                .extracting(DashboardResponse.DashboardEntry::foodName)
                .containsExactly("First", "Second");
        DashboardResponse.DashboardEntry mapped = body.entries().get(1);
        assertThat(mapped.id()).isEqualTo(second.getId());
        assertThat(mapped.source()).isEqualTo("USDA");
        assertThat(mapped.mealLabel()).isEqualTo("lunch");
        assertThat(mapped.calories()).isEqualByComparingTo("20.0");
        assertThat(mapped.protein()).isEqualByComparingTo("4.0");
        assertThat(mapped.carbs()).isEqualByComparingTo("5.0");
        assertThat(mapped.fat()).isEqualByComparingTo("6.0");
        assertThat(mapped.loggedAt()).isEqualTo(second.getLoggedAt());
    }

    @Test
    @DisplayName("includes the streak as of today, whatever date was requested")
    void shouldIncludeStreakFromStreakService() {
        User user = givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(LocalDate.of(2026, 1, 1));

        DashboardResponse body = dashboardFor(LocalDate.of(2026, 1, 1));

        assertThat(body.streak()).isEqualTo(STREAK);
        verify(streakService).streakFor(user);
    }

    @Test
    @DisplayName("wraps the body in a 200 success envelope")
    void shouldReturnSuccessEnvelope() {
        givenUser("UTC");
        givenGoals(2000, 150, 200, 65);
        givenEntries(UTC_TODAY);

        ApiResponse<DashboardResponse> response = service().get(USER_ID, UTC_TODAY);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getMessage()).isEqualTo("Success");
        assertThat(response.getTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("throws 404 for a deleted or unknown user and reads nothing else")
    void shouldThrowNotFoundForMissingUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().get(USER_ID, UTC_TODAY))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo("User not found");
                        });

        verifyNoInteractions(trackingEntryRepository, goalsService, streakService);
    }
}
