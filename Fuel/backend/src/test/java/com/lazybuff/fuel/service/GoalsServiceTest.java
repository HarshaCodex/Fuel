package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.GoalsRequest;
import com.lazybuff.fuel.dto.GoalsResponse;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoalsService")
class GoalsServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private UserGoalsRepository userGoalsRepository;

    @Mock private UserRepository userRepository;

    @InjectMocks private GoalsService service;

    private final User user = User.builder().id(USER_ID).email("a@b.com").name("A").build();

    private static GoalsRequest request(String protein, String carb, String fat) {
        return new GoalsRequest(
                1800, new BigDecimal(protein), new BigDecimal(carb), new BigDecimal(fat));
    }

    private void givenActiveUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
    }

    private UserGoals savedFromPut(GoalsRequest request) {
        ArgumentCaptor<UserGoals> captor = ArgumentCaptor.forClass(UserGoals.class);
        when(userGoalsRepository.saveAndFlush(any(UserGoals.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        service.put(USER_ID, request);
        verify(userGoalsRepository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("returns the defaults and saves nothing when no row exists")
    void shouldReturnDefaultsWhenNoRow() {
        givenActiveUser();
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());

        GoalsResponse data = service.get(USER_ID).getData();

        assertThat(data.calorieGoal()).isEqualTo(2000);
        assertThat(data.proteinGoal()).isEqualTo(50.0);
        assertThat(data.carbGoal()).isEqualTo(250.0);
        assertThat(data.fatGoal()).isEqualTo(65.0);
        assertThat(data.isAutoCalculated()).isFalse();
        assertThat(data.updatedAt()).isNull();
        verify(userGoalsRepository, never()).save(any());
        verify(userGoalsRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("returns the stored goals")
    void shouldReturnStoredGoals() {
        givenActiveUser();
        OffsetDateTime updated = OffsetDateTime.parse("2026-06-05T08:00:00Z");
        UserGoals row =
                UserGoals.builder()
                        .user(user)
                        .calorieGoal(2200)
                        .proteinGoal(165.0)
                        .carbGoal(248.0)
                        .fatGoal(73.0)
                        .isAutoCalculated(true)
                        .updatedAt(updated)
                        .build();
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.of(row));

        GoalsResponse data = service.get(USER_ID).getData();

        assertThat(data).isEqualTo(new GoalsResponse(2200, 165.0, 248.0, 73.0, true, updated));
    }

    @Test
    @DisplayName("getGoals does not check the user")
    void shouldNotCheckUserInGetGoals() {
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());

        service.getGoals(USER_ID);

        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("inserts a row when none exists")
    void shouldInsertWhenNoRow() {
        givenActiveUser();
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());

        UserGoals saved = savedFromPut(request("150.0", "180.0", "60.0"));

        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getCalorieGoal()).isEqualTo(1800);
        assertThat(saved.getProteinGoal()).isEqualTo(150.0);
        assertThat(saved.getCarbGoal()).isEqualTo(180.0);
        assertThat(saved.getFatGoal()).isEqualTo(60.0);
        assertThat(saved.isAutoCalculated()).isFalse();
    }

    @Test
    @DisplayName("updates the existing row, clears isAutoCalculated and keeps goalType")
    void shouldUpdateExistingRow() {
        givenActiveUser();
        UserGoals existing =
                UserGoals.builder()
                        .user(user)
                        .isAutoCalculated(true)
                        .goalType("CUT")
                        .calorieAdjustment(-500)
                        .build();
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.of(existing));

        UserGoals saved = savedFromPut(request("150", "180", "60"));

        assertThat(saved).isSameAs(existing);
        assertThat(saved.isAutoCalculated()).isFalse();
        assertThat(saved.getGoalType()).isEqualTo("CUT");
        assertThat(saved.getCalorieAdjustment()).isEqualTo(-500);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("rounds macros to one decimal place half up")
    void shouldRoundMacrosToOneDecimal() {
        givenActiveUser();
        when(userGoalsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());

        UserGoals saved = savedFromPut(request("150.25", "180.04", "9999.9"));

        assertThat(saved.getProteinGoal()).isEqualTo(150.3);
        assertThat(saved.getCarbGoal()).isEqualTo(180.0);
        assertThat(saved.getFatGoal()).isEqualTo(9999.9);
    }

    @Test
    @DisplayName("returns 404 on get when the user is missing or deleted")
    void shouldReturnNotFoundOnGet() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(USER_ID))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(userGoalsRepository);
    }

    @Test
    @DisplayName("returns 404 on put when the user is missing or deleted")
    void shouldReturnNotFoundOnPut() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.put(USER_ID, request("1", "1", "1")))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(userGoalsRepository);
    }
}
