package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.TrackingConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.TrackingEntry;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.TrackingEntryRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("TrackingService")
class TrackingServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FOOD_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock private FoodItemRepository foodItemRepository;

    @Mock private TrackingEntryRepository trackingEntryRepository;

    @Mock private UserRepository userRepository;

    private TrackingService service;

    private User user;

    @BeforeEach
    void setUp() {
        service =
                new TrackingService(
                        foodItemRepository,
                        trackingEntryRepository,
                        userRepository,
                        new TrackingConfig());
        user = User.builder().id(USER_ID).timezone("UTC").build();
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    private static FoodItem chicken() {
        return food("100", "165", "31", "0", "3.6", "0");
    }

    private static FoodItem food(
            String size, String cal, String protein, String carbs, String fat, String fiber) {
        return FoodItem.builder()
                .id(FOOD_ID)
                .name("Chicken breast")
                .source(FoodSource.USDA)
                .servingSize(bd(size))
                .servingUnit(ServingUnit.G)
                .calories(bd(cal))
                .protein(bd(protein))
                .carbs(bd(carbs))
                .fat(bd(fat))
                .fiber(bd(fiber))
                .build();
    }

    private static TrackingEntryRequest request(
            String size, String unit, String quantity, OffsetDateTime loggedAt) {
        return new TrackingEntryRequest(FOOD_ID, bd(size), unit, bd(quantity), "lunch", loggedAt);
    }

    private void givenUserAndFood(FoodItem food) {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(foodItemRepository.findLoggableById(FOOD_ID, USER_ID))
                .thenReturn(Optional.ofNullable(food));
        lenient()
                .when(trackingEntryRepository.save(any(TrackingEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private TrackingEntry savedEntry() {
        ArgumentCaptor<TrackingEntry> captor = ArgumentCaptor.forClass(TrackingEntry.class);
        verify(trackingEntryRepository).save(captor.capture());
        return captor.getValue();
    }

    private void assertBadRequest(TrackingEntryRequest request, String message) {
        assertThatThrownBy(() -> service.create(USER_ID, request))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(e.getMessage()).isEqualTo(message);
                        });
    }

    @Test
    @DisplayName("scales nutrients by serving size over the food's serving size")
    void shouldScaleNutrientsByServingSize() {
        givenUserAndFood(chicken());

        ApiResponse<TrackingEntryResponse> result =
                service.create(USER_ID, request("150", "g", "1", null));

        TrackingEntryResponse data = result.getData();
        assertThat(result.getStatus()).isEqualTo(201);
        assertThat(result.getMessage()).isEqualTo("Entry logged");
        assertThat(data.getCalories()).isEqualByComparingTo("247.5");
        assertThat(data.getProtein()).isEqualByComparingTo("46.50");
        assertThat(data.getCarbs()).isEqualByComparingTo("0.00");
        assertThat(data.getFat()).isEqualByComparingTo("5.40");
        assertThat(data.getFiber()).isEqualByComparingTo("0.00");
        assertThat(data.getSource()).isEqualTo("USDA");
        assertThat(data.getServingUnit()).isEqualTo("g");
        assertThat(data.getFoodName()).isEqualTo("Chicken breast");
    }

    @Test
    @DisplayName("scales nutrients by a fractional quantity")
    void shouldScaleNutrientsByQuantity() {
        givenUserAndFood(chicken());

        service.create(USER_ID, request("100", "g", "1.5", null));

        TrackingEntry entry = savedEntry();
        assertThat(entry.getCalories()).isEqualByComparingTo("247.5");
        assertThat(entry.getProtein()).isEqualByComparingTo("46.50");
    }

    @Test
    @DisplayName("rounds half up to one decimal for calories and two for macros")
    void shouldRoundHalfUp() {
        givenUserAndFood(food("100", "100", "10", "10", "10", "10"));

        service.create(USER_ID, request("0.5", "g", "1", null));
        // 100*0.5/100 = 0.5 cal; 10*0.5/100 = 0.05 macro
        TrackingEntry entry = savedEntry();
        assertThat(entry.getCalories()).isEqualByComparingTo("0.5");
        assertThat(entry.getProtein()).isEqualByComparingTo("0.05");
        assertThat(entry.getProtein().scale()).isEqualTo(2);
    }

    @Test
    @DisplayName("rounds a half calorie value up")
    void shouldRoundCaloriesHalfUp() {
        givenUserAndFood(food("100", "1.5", "1", "1", "1", "0"));

        service.create(USER_ID, request("5", "g", "1", null));

        // 1.5 * 5 / 100 = 0.075 -> 0.1
        assertThat(savedEntry().getCalories()).isEqualByComparingTo("0.1");
    }

    @Test
    @DisplayName("returns 404 when the food does not exist")
    void shouldReturn404WhenFoodMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(foodItemRepository.findLoggableById(FOOD_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(USER_ID, request("100", "g", "1", null)))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo("Food item not found");
                        });
        verifyNoInteractions(trackingEntryRepository);
    }

    @Test
    @DisplayName("looks the food up with the caller's id so another user's food is hidden")
    void shouldLookUpFoodWithCallerId() {
        givenUserAndFood(chicken());

        service.create(USER_ID, request("100", "g", "1", null));

        verify(foodItemRepository).findLoggableById(FOOD_ID, USER_ID);
    }

    @Test
    @DisplayName("returns 400 when the unit differs from the food's unit")
    void shouldReturn400WhenUnitMismatch() {
        givenUserAndFood(chicken());

        assertBadRequest(
                request("100", "ml", "1", null), "servingUnit must match the food's serving unit");
    }

    @Test
    @DisplayName("uses the current time when loggedAt is missing")
    void shouldDefaultLoggedAtToNow() {
        givenUserAndFood(chicken());
        OffsetDateTime before = OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(1);

        service.create(USER_ID, request("100", "g", "1", null));

        assertThat(savedEntry().getLoggedAt())
                .isBetween(before, OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(1));
    }

    @Test
    @DisplayName("returns 400 when loggedAt is two days ahead")
    void shouldReturn400WhenTooFarInFuture() {
        givenUserAndFood(chicken());

        assertBadRequest(
                request("100", "g", "1", OffsetDateTime.now(ZoneOffset.UTC).plusDays(2)),
                "loggedAt is too far in the future");
    }

    @Test
    @DisplayName("accepts loggedAt one hour ahead")
    void shouldAcceptLoggedAtOneHourAhead() {
        givenUserAndFood(chicken());

        service.create(USER_ID, request("100", "g", "1", OffsetDateTime.now().plusHours(1)));

        assertThat(savedEntry()).isNotNull();
    }

    @Test
    @DisplayName("keeps the same instant for a non-UTC offset")
    void shouldKeepInstantForOffset() {
        givenUserAndFood(chicken());
        OffsetDateTime loggedAt = OffsetDateTime.parse("2026-06-09T18:00:00+05:30");

        service.create(USER_ID, request("100", "g", "1", loggedAt));

        assertThat(savedEntry().getLoggedAt().toInstant()).isEqualTo(loggedAt.toInstant());
    }

    @Test
    @DisplayName("dates the entry in the user's timezone, ahead of UTC")
    void shouldUseLocalDateForEasternTimezone() {
        user.setTimezone("Asia/Kolkata");
        givenUserAndFood(chicken());

        service.create(
                USER_ID, request("100", "g", "1", OffsetDateTime.parse("2026-06-10T18:00:00Z")));

        assertThat(savedEntry().getLogDate()).isEqualTo(LocalDate.of(2026, 6, 10));
    }

    @Test
    @DisplayName("dates the entry in the user's timezone, behind UTC")
    void shouldUseLocalDateForWesternTimezone() {
        user.setTimezone("America/Los_Angeles");
        givenUserAndFood(chicken());

        service.create(
                USER_ID, request("100", "g", "1", OffsetDateTime.parse("2026-06-10T03:00:00Z")));

        assertThat(savedEntry().getLogDate()).isEqualTo(LocalDate.of(2026, 6, 9));
    }

    @Test
    @DisplayName("falls back to UTC when the stored timezone is invalid")
    void shouldFallBackToUtcForInvalidTimezone() {
        user.setTimezone("Not/AZone");
        givenUserAndFood(chicken());

        service.create(
                USER_ID, request("100", "g", "1", OffsetDateTime.parse("2026-06-10T23:30:00Z")));

        assertThat(savedEntry().getLogDate()).isEqualTo(LocalDate.of(2026, 6, 10));
    }

    @Test
    @DisplayName("returns 400 when the computed values overflow the columns")
    void shouldReturn400WhenEntryTooLarge() {
        givenUserAndFood(food("0.1", "900", "1", "1", "1", "0"));

        assertBadRequest(request("999999", "g", "999", null), "Entry is too large");
    }

    @Test
    @DisplayName("returns 404 when the caller is deleted")
    void shouldReturn404WhenUserDeleted() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(USER_ID, request("100", "g", "1", null)))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo("User not found");
                        });
        verifyNoInteractions(foodItemRepository, trackingEntryRepository);
    }
}
