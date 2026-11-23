package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.TrackingConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.TrackingEntryRequest;
import com.lazybuff.fuel.dto.TrackingEntryResponse;
import com.lazybuff.fuel.dto.TrackingEntryUpdateRequest;
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
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
    @DisplayName("rounds a calorie tie up (0.25 becomes 0.3)")
    void shouldRoundCalorieTieHalfUp() {
        givenUserAndFood(food("100", "2.5", "1", "1", "1", "1"));

        service.create(USER_ID, request("10", "g", "1", null));

        assertThat(savedEntry().getCalories()).isEqualByComparingTo("0.3");
    }

    @Test
    @DisplayName("rounds a macro tie up (0.025 becomes 0.03)")
    void shouldRoundMacroTieHalfUp() {
        givenUserAndFood(food("100", "1", "2.5", "2.5", "2.5", "2.5"));

        service.create(USER_ID, request("1", "g", "1", null));

        TrackingEntry entry = savedEntry();
        assertThat(entry.getProtein()).isEqualByComparingTo("0.03");
        assertThat(entry.getCarbs()).isEqualByComparingTo("0.03");
        assertThat(entry.getFat()).isEqualByComparingTo("0.03");
        assertThat(entry.getFiber()).isEqualByComparingTo("0.03");
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

    @ParameterizedTest(name = "{0}")
    @CsvSource({
        "calories,1000000,0,0,0,0",
        "protein,0,100000,0,0,0",
        "carbs,0,0,100000,0,0",
        "fat,0,0,0,100000,0",
        "fiber,0,0,0,0,100000"
    })
    @DisplayName("returns 400 when only one nutrient overflows its column")
    void shouldReturn400WhenSingleNutrientTooLarge(
            String ignored, String cal, String protein, String carbs, String fat, String fiber) {
        givenUserAndFood(food("1", cal, protein, carbs, fat, fiber));

        assertBadRequest(request("1", "g", "1", null), "Entry is too large");
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

    private static final UUID ENTRY_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private TrackingEntry entryOf(UUID owner, String loggedAt, LocalDate logDate) {
        return TrackingEntry.builder()
                .id(ENTRY_ID)
                .user(User.builder().id(owner).build())
                .foodId(FOOD_ID)
                .foodName("Chicken breast")
                .foodSource(FoodSource.USDA)
                .servingSize(bd("100"))
                .servingUnit(ServingUnit.G)
                .quantity(bd("1"))
                .loggedAt(OffsetDateTime.parse(loggedAt))
                .logDate(logDate)
                .calories(bd("165"))
                .protein(bd("31"))
                .carbs(bd("0"))
                .fat(bd("3.6"))
                .fiber(bd("0"))
                .build();
    }

    private void assertNotFound(org.junit.jupiter.api.function.Executable call, String message) {
        assertThatThrownBy(call::execute)
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo(message);
                        });
    }

    @Test
    @DisplayName("lists the entries of the given date")
    void shouldListEntriesOfGivenDate() {
        LocalDate day = LocalDate.of(2026, 6, 9);
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                        USER_ID, day))
                .thenReturn(List.of(entryOf(USER_ID, "2026-06-09T08:00:00Z", day)));

        ApiResponse<List<TrackingEntryResponse>> result = service.listByDate(USER_ID, day);

        assertThat(result.getStatus()).isEqualTo(200);
        assertThat(result.getMessage()).isEqualTo("Success");
        assertThat(result.getData()).hasSize(1);
        assertThat(result.getData().get(0).getId()).isEqualTo(ENTRY_ID);
    }

    @Test
    @DisplayName("lists today in the user's timezone when no date is given")
    void shouldListTodayInUserTimezoneWhenDateMissing() {
        user.setTimezone("Asia/Kolkata");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                        USER_ID, today))
                .thenReturn(List.of());

        service.listByDate(USER_ID, null);

        verify(trackingEntryRepository)
                .findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(USER_ID, today);
    }

    @Test
    @DisplayName("returns an empty list when the day has no entries")
    void shouldReturnEmptyListWhenNoEntries() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByUserIdAndLogDateOrderByLoggedAtAscCreatedAtAsc(
                        any(), any()))
                .thenReturn(List.of());

        ApiResponse<List<TrackingEntryResponse>> result =
                service.listByDate(USER_ID, LocalDate.of(2026, 6, 9));

        assertThat(result.getData()).isEmpty();
    }

    @Test
    @DisplayName("list returns 404 when the caller is deleted")
    void shouldReturn404OnListWhenUserDeleted() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertNotFound(() -> service.listByDate(USER_ID, null), "User not found");
        verifyNoInteractions(trackingEntryRepository);
    }

    @Test
    @DisplayName("delete soft-deletes the entry")
    void shouldSoftDeleteEntry() {
        TrackingEntry entry = entryOf(USER_ID, "2026-06-09T08:00:00Z", LocalDate.of(2026, 6, 9));
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByIdAndUserId(ENTRY_ID, USER_ID))
                .thenReturn(Optional.of(entry));

        ApiResponse<Void> result = service.delete(USER_ID, ENTRY_ID);

        assertThat(result.getStatus()).isEqualTo(204);
        assertThat(result.getMessage()).isEqualTo("Entry deleted");
        assertThat(savedEntry().getDeletedAt()).isNotNull();
    }

    @Test
    @DisplayName("delete returns 404 for another user's or an unknown entry")
    void shouldReturn404WhenEntryBelongsToAnotherUserOrUnknown() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByIdAndUserId(ENTRY_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertNotFound(() -> service.delete(USER_ID, ENTRY_ID), "Entry not found");
        verify(trackingEntryRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete returns 404 when the caller is deleted")
    void shouldReturn404OnDeleteWhenUserDeleted() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertNotFound(() -> service.delete(USER_ID, ENTRY_ID), "User not found");
        verifyNoInteractions(trackingEntryRepository);
    }

    private void givenOwnedEntry(TrackingEntry entry) {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByIdAndUserId(ENTRY_ID, USER_ID))
                .thenReturn(Optional.of(entry));
        lenient()
                .when(trackingEntryRepository.save(any(TrackingEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private static TrackingEntryUpdateRequest update(
            String size, String quantity, String meal, OffsetDateTime loggedAt) {
        TrackingEntryUpdateRequest request = new TrackingEntryUpdateRequest();
        request.setServingSize(size != null ? bd(size) : null);
        request.setQuantity(quantity != null ? bd(quantity) : null);
        request.setMealLabel(meal);
        request.setLoggedAt(loggedAt);
        return request;
    }

    private TrackingEntry entryAt150g() {
        TrackingEntry entry = entryOf(USER_ID, "2026-06-09T08:00:00Z", LocalDate.of(2026, 6, 9));
        entry.setServingSize(bd("150"));
        entry.setCalories(bd("247.5"));
        return entry;
    }

    @Test
    @DisplayName("update recomputes nutrients from the original food for a new serving size")
    void shouldRecomputeNutrientsWhenServingSizeChanges() {
        TrackingEntry entry = entryAt150g();
        givenOwnedEntry(entry);
        when(foodItemRepository.findById(FOOD_ID)).thenReturn(Optional.of(chicken()));

        ApiResponse<TrackingEntryResponse> result =
                service.update(USER_ID, ENTRY_ID, update("200", null, null, null));

        assertThat(result.getStatus()).isEqualTo(200);
        assertThat(result.getMessage()).isEqualTo("Entry updated");
        TrackingEntry saved = savedEntry();
        assertThat(saved.getServingSize()).isEqualByComparingTo("200");
        assertThat(saved.getCalories()).isEqualTo(bd("330.0"));
        assertThat(saved.getProtein()).isEqualTo(bd("62.00"));
        assertThat(saved.getCarbs()).isEqualTo(bd("0.00"));
        assertThat(saved.getFat()).isEqualTo(bd("7.20"));
        assertThat(saved.getFiber()).isEqualTo(bd("0.00"));
    }

    @Test
    @DisplayName("update recomputes nutrients when only the quantity changes")
    void shouldRecomputeNutrientsWhenQuantityChanges() {
        givenOwnedEntry(entryAt150g());
        when(foodItemRepository.findById(FOOD_ID)).thenReturn(Optional.of(chicken()));

        service.update(USER_ID, ENTRY_ID, update(null, "2", null, null));

        TrackingEntry saved = savedEntry();
        assertThat(saved.getServingSize()).isEqualByComparingTo("150");
        assertThat(saved.getCalories()).isEqualTo(bd("495.0"));
    }

    @Test
    @DisplayName("update of the meal alone leaves nutrients untouched and skips the food lookup")
    void shouldKeepNutrientsWhenOnlyMealChanges() {
        givenOwnedEntry(entryAt150g());

        service.update(USER_ID, ENTRY_ID, update(null, null, "dinner", null));

        TrackingEntry saved = savedEntry();
        assertThat(saved.getMealLabel()).isEqualTo("dinner");
        assertThat(saved.getCalories()).isEqualTo(bd("247.5"));
        verifyNoInteractions(foodItemRepository);
    }

    @Test
    @DisplayName("update of loggedAt moves the log date across a timezone boundary")
    void shouldChangeLogDateWhenLoggedAtChanges() {
        user.setTimezone("Asia/Kolkata");
        givenOwnedEntry(entryAt150g());
        OffsetDateTime loggedAt = OffsetDateTime.parse("2026-06-10T20:00:00Z");

        service.update(USER_ID, ENTRY_ID, update(null, null, null, loggedAt));

        TrackingEntry saved = savedEntry();
        assertThat(saved.getLoggedAt().toInstant()).isEqualTo(loggedAt.toInstant());
        assertThat(saved.getLogDate()).isEqualTo(LocalDate.of(2026, 6, 11));
    }

    @Test
    @DisplayName("update returns 400 when loggedAt is too far ahead")
    void shouldReturn400OnUpdateWhenLoggedAtTooFarAhead() {
        givenOwnedEntry(entryAt150g());
        TrackingEntryUpdateRequest request =
                update(null, null, null, OffsetDateTime.now(ZoneOffset.UTC).plusDays(2));

        assertThatThrownBy(() -> service.update(USER_ID, ENTRY_ID, request))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(e.getMessage())
                                    .isEqualTo("loggedAt is too far in the future");
                        });
        verify(trackingEntryRepository, never()).save(any());
    }

    @Test
    @DisplayName("update returns 400 when the recomputed entry is too large")
    void shouldReturn400OnUpdateWhenEntryTooLarge() {
        givenOwnedEntry(entryAt150g());
        when(foodItemRepository.findById(FOOD_ID)).thenReturn(Optional.of(chicken()));
        TrackingEntryUpdateRequest request = update("999999", "999", null, null);

        assertThatThrownBy(() -> service.update(USER_ID, ENTRY_ID, request))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                            assertThat(e.getMessage()).isEqualTo("Entry is too large");
                        });
        verify(trackingEntryRepository, never()).save(any());
    }

    @Test
    @DisplayName("update scales from the entry's own snapshot when the food is gone")
    void shouldScaleFromSnapshotWhenFoodGone() {
        givenOwnedEntry(entryAt150g());
        when(foodItemRepository.findById(FOOD_ID)).thenReturn(Optional.empty());

        service.update(USER_ID, ENTRY_ID, update("200", null, null, null));

        // Snapshot 247.5 kcal was for 150 g x 1 here, so 200 g gives 330.0.
        assertThat(savedEntry().getCalories()).isEqualTo(bd("330.0"));
    }

    @Test
    @DisplayName("update returns 404 for another user's or an unknown entry")
    void shouldReturn404OnUpdateWhenEntryBelongsToAnotherUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
        when(trackingEntryRepository.findByIdAndUserId(ENTRY_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertNotFound(
                () -> service.update(USER_ID, ENTRY_ID, update("200", null, null, null)),
                "Entry not found");
        verify(trackingEntryRepository, never()).save(any());
    }

    @Test
    @DisplayName("update returns 404 when the caller is deleted")
    void shouldReturn404OnUpdateWhenUserDeleted() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertNotFound(
                () -> service.update(USER_ID, ENTRY_ID, update(null, null, null, null)),
                "User not found");
        verifyNoInteractions(trackingEntryRepository);
    }
}
