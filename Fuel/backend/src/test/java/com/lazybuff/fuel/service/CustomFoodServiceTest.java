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
}
