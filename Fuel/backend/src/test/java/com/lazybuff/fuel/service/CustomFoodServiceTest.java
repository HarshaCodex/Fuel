package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.CustomFoodRequest;
import com.lazybuff.fuel.dto.CustomFoodResponse;
import com.lazybuff.fuel.dto.PageResponse;
import com.lazybuff.fuel.entity.FoodItem;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.mapper.CustomFoodMapper;
import com.lazybuff.fuel.repository.FoodItemRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("CustomFoodService")
class CustomFoodServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private FoodItemRepository foodItemRepository;

    @Mock private UserRepository userRepository;

    // The real mapper: it carries the source, unit and fiber rules the service relies on.
    private final CustomFoodMapper mapper = Mappers.getMapper(CustomFoodMapper.class);

    private final User user = User.builder().id(USER_ID).email("a@b.com").name("A").build();

    private CustomFoodService service() {
        return new CustomFoodService(foodItemRepository, userRepository, mapper);
    }

    private void givenActiveUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
    }

    private static CustomFoodRequest request() {
        return new CustomFoodRequest(
                "Mom's Dal Tadka",
                null,
                new BigDecimal("200"),
                "g",
                new BigDecimal("180"),
                new BigDecimal("9.0"),
                new BigDecimal("24.0"),
                new BigDecimal("5.0"),
                null);
    }

    private static FoodItem food(String name, User owner) {
        return FoodItem.builder()
                .id(UUID.randomUUID())
                .user(owner)
                .name(name)
                .source(FoodSource.USER)
                .servingSize(new BigDecimal("100"))
                .servingUnit(ServingUnit.G)
                .calories(BigDecimal.TEN)
                .protein(BigDecimal.ONE)
                .carbs(BigDecimal.ONE)
                .fat(BigDecimal.ONE)
                .build();
    }

    @Test
    @DisplayName("saves a USER food owned by the caller and returns 201")
    void shouldSaveUserFoodOwnedByCaller() {
        givenActiveUser();
        when(foodItemRepository.save(any(FoodItem.class))).thenAnswer(i -> i.getArgument(0));

        ApiResponse<CustomFoodResponse> result = service().create(USER_ID, request());

        ArgumentCaptor<FoodItem> captor = ArgumentCaptor.forClass(FoodItem.class);
        verify(foodItemRepository).save(captor.capture());
        FoodItem saved = captor.getValue();
        assertThat(saved.getSource()).isEqualTo(FoodSource.USER);
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getSourceId()).isNull();
        assertThat(saved.getBarcode()).isNull();
        assertThat(saved.getFiber()).isEqualByComparingTo("0");
        assertThat(result.getStatus()).isEqualTo(201);
        assertThat(result.getMessage()).isEqualTo("Custom food created");
        assertThat(result.getData().getCreatedBy()).isEqualTo(USER_ID);
        assertThat(result.getData().getServingUnit()).isEqualTo("g");
        assertThat(result.getData().getSource()).isEqualTo("USER");
    }

    @Test
    @DisplayName("throws 404 and saves nothing when the user is not found")
    void shouldThrowNotFoundOnCreateWhenUserMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().create(USER_ID, request()))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(foodItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("lists the caller's USER foods with the requested page and size")
    void shouldListCallersFoodsPaged() {
        givenActiveUser();
        Pageable pageable = PageRequest.of(2, 20);
        Page<FoodItem> page =
                new PageImpl<>(List.of(food("A", user), food("B", user)), pageable, 42);
        when(foodItemRepository.findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(
                        FoodSource.USER, USER_ID, pageable))
                .thenReturn(page);

        ApiResponse<PageResponse<CustomFoodResponse>> result = service().list(USER_ID, 2, 20);

        assertThat(result.getStatus()).isEqualTo(200);
        PageResponse<CustomFoodResponse> data = result.getData();
        assertThat(data.getContent())
                .extracting(CustomFoodResponse::getName)
                .containsExactly("A", "B");
        assertThat(data.getPage()).isEqualTo(2);
        assertThat(data.getSize()).isEqualTo(20);
        assertThat(data.getTotalElements()).isEqualTo(42);
        assertThat(data.getTotalPages()).isEqualTo(3);
    }

    @Test
    @DisplayName("returns an empty page with zero totals when there are no foods")
    void shouldReturnEmptyPageWhenNoFoods() {
        givenActiveUser();
        Pageable pageable = PageRequest.of(0, 20);
        when(foodItemRepository.findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(
                        FoodSource.USER, USER_ID, pageable))
                .thenReturn(Page.empty(pageable));

        PageResponse<CustomFoodResponse> data = service().list(USER_ID, 0, 20).getData();

        assertThat(data.getContent()).isEmpty();
        assertThat(data.getTotalElements()).isZero();
        assertThat(data.getTotalPages()).isZero();
    }

    @Test
    @DisplayName("throws 404 on list when the user is not found")
    void shouldThrowNotFoundOnListWhenUserMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().list(USER_ID, 0, 20))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(foodItemRepository, never())
                .findBySourceAndUser_IdOrderByCreatedAtDescIdDesc(any(), any(), any());
    }

    private void givenOwnedFood(UUID foodId, FoodItem existing) {
        when(foodItemRepository.findByIdAndSourceAndUser_Id(foodId, FoodSource.USER, USER_ID))
                .thenReturn(Optional.of(existing));
    }

    private static void assertNotFound(Throwable thrown, String message) {
        assertThat(thrown)
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> {
                            assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                            assertThat(e.getMessage()).isEqualTo(message);
                        });
    }

    @Test
    @DisplayName("update replaces the editable fields and keeps id, owner and creation time")
    void shouldReplaceEditableFieldsOnUpdate() {
        givenActiveUser();
        FoodItem existing = food("Old", user);
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-01-02T03:04:05Z");
        existing.setCreatedAt(createdAt);
        existing.setFiber(new BigDecimal("7"));
        existing.setBrand("OldBrand");
        UUID foodId = existing.getId();
        givenOwnedFood(foodId, existing);
        when(foodItemRepository.save(any(FoodItem.class))).thenAnswer(i -> i.getArgument(0));
        CustomFoodRequest req =
                new CustomFoodRequest(
                        "  New Dal  ",
                        "   ",
                        new BigDecimal("250"),
                        "ml",
                        new BigDecimal("300"),
                        new BigDecimal("11.0"),
                        new BigDecimal("30.0"),
                        new BigDecimal("6.0"),
                        null);

        ApiResponse<CustomFoodResponse> result = service().update(USER_ID, foodId, req);

        ArgumentCaptor<FoodItem> captor = ArgumentCaptor.forClass(FoodItem.class);
        verify(foodItemRepository).save(captor.capture());
        FoodItem saved = captor.getValue();
        assertThat(saved).isSameAs(existing);
        assertThat(saved.getName()).isEqualTo("New Dal");
        assertThat(saved.getBrand()).isNull();
        assertThat(saved.getServingUnit()).isEqualTo(ServingUnit.ML);
        assertThat(saved.getCalories()).isEqualByComparingTo("300");
        assertThat(saved.getFiber()).isEqualByComparingTo("0");
        assertThat(saved.getId()).isEqualTo(foodId);
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getSource()).isEqualTo(FoodSource.USER);
        assertThat(saved.getCreatedAt()).isEqualTo(createdAt);
        assertThat(saved.getDeletedAt()).isNull();
        assertThat(result.getStatus()).isEqualTo(200);
        assertThat(result.getMessage()).isEqualTo("Custom food updated");
        assertThat(result.getData().getId()).isEqualTo(foodId);
        assertThat(result.getData().getCreatedBy()).isEqualTo(USER_ID);
        assertThat(result.getData().getName()).isEqualTo("New Dal");
        assertThat(result.getData().getCreatedAt()).isEqualTo(createdAt);
    }

    @Test
    @DisplayName("update throws 404 and saves nothing when the food is not owned or not found")
    void shouldThrowNotFoundOnUpdateWhenFoodNotOwned() {
        givenActiveUser();
        UUID foodId = UUID.randomUUID();
        when(foodItemRepository.findByIdAndSourceAndUser_Id(foodId, FoodSource.USER, USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().update(USER_ID, foodId, request()))
                .satisfies(e -> assertNotFound(e, "Food item not found"));
        verify(foodItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("update throws 404 and looks up no food when the user is not found")
    void shouldThrowNotFoundOnUpdateWhenUserMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().update(USER_ID, UUID.randomUUID(), request()))
                .satisfies(e -> assertNotFound(e, "User not found"));
        verify(foodItemRepository, never()).findByIdAndSourceAndUser_Id(any(), any(), any());
        verify(foodItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete sets deletedAt on the owned food and saves it")
    void shouldSoftDeleteOwnedFood() {
        givenActiveUser();
        FoodItem existing = food("Dal", user);
        UUID foodId = existing.getId();
        givenOwnedFood(foodId, existing);
        OffsetDateTime before = OffsetDateTime.now();

        ApiResponse<Void> result = service().delete(USER_ID, foodId);

        verify(foodItemRepository).save(existing);
        verify(foodItemRepository, never()).delete(any(FoodItem.class));
        assertThat(existing.getDeletedAt()).isNotNull().isAfterOrEqualTo(before);
        assertThat(result.getStatus()).isEqualTo(204);
        assertThat(result.getData()).isNull();
    }

    @Test
    @DisplayName("delete throws 404 and saves nothing when the food is not owned or not found")
    void shouldThrowNotFoundOnDeleteWhenFoodNotOwned() {
        givenActiveUser();
        UUID foodId = UUID.randomUUID();
        when(foodItemRepository.findByIdAndSourceAndUser_Id(foodId, FoodSource.USER, USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().delete(USER_ID, foodId))
                .satisfies(e -> assertNotFound(e, "Food item not found"));
        verify(foodItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete throws 404 and looks up no food when the user is not found")
    void shouldThrowNotFoundOnDeleteWhenUserMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().delete(USER_ID, UUID.randomUUID()))
                .satisfies(e -> assertNotFound(e, "User not found"));
        verify(foodItemRepository, never()).findByIdAndSourceAndUser_Id(any(), any(), any());
        verify(foodItemRepository, never()).save(any());
    }
}
