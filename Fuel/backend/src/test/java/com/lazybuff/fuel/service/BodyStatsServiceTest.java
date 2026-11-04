package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.BodyStatsRequest;
import com.lazybuff.fuel.dto.BodyStatsResponse;
import com.lazybuff.fuel.entity.BodyStats;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.BodyStatsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("BodyStatsService")
class BodyStatsServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Mock private BodyStatsRepository bodyStatsRepository;

    @Mock private UserRepository userRepository;

    @InjectMocks private BodyStatsService service;

    private final User user = User.builder().id(USER_ID).email("a@b.com").name("A").build();

    private static BodyStatsRequest request(
            String height, String heightUnit, String weight, String weightUnit, int age) {
        return new BodyStatsRequest(
                new BigDecimal(height),
                heightUnit,
                new BigDecimal(weight),
                weightUnit,
                age,
                "MALE",
                "MODERATE");
    }

    private void givenActiveUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.of(user));
    }

    private BodyStats savedFromPut(BodyStatsRequest request) {
        ArgumentCaptor<BodyStats> captor = ArgumentCaptor.forClass(BodyStats.class);
        service.put(USER_ID, request);
        verify(bodyStatsRepository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("returns the stored stats in metric")
    void shouldReturnStoredStats() {
        givenActiveUser();
        OffsetDateTime updated = OffsetDateTime.parse("2026-06-05T08:00:00Z");
        when(bodyStatsRepository.findByUser_Id(USER_ID))
                .thenReturn(
                        Optional.of(
                                BodyStats.builder()
                                        .user(user)
                                        .heightCm(new BigDecimal("175.0"))
                                        .weightKg(new BigDecimal("72.5"))
                                        .age(25)
                                        .gender("MALE")
                                        .activityLevel("MODERATE")
                                        .updatedAt(updated)
                                        .build()));

        ApiResponse<BodyStatsResponse> response = service.get(USER_ID);

        assertThat(response.getStatus()).isEqualTo(200);
        BodyStatsResponse data = response.getData();
        assertThat(data.getHeight()).isEqualByComparingTo("175");
        assertThat(data.getHeightUnit()).isEqualTo("cm");
        assertThat(data.getWeight()).isEqualByComparingTo("72.5");
        assertThat(data.getWeightUnit()).isEqualTo("kg");
        assertThat(data.getAge()).isEqualTo(25);
        assertThat(data.getGender()).isEqualTo("MALE");
        assertThat(data.getActivityLevel()).isEqualTo("MODERATE");
        assertThat(data.getUpdatedAt()).isEqualTo(updated);
    }

    @Test
    @DisplayName("returns null data when the user never saved stats")
    void shouldReturnNullDataWhenNoneSaved() {
        givenActiveUser();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());

        ApiResponse<BodyStatsResponse> response = service.get(USER_ID);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(response.getData()).isNull();
    }

    @Test
    @DisplayName("creates a new row linked to the caller")
    void shouldInsertWhenNoneExist() {
        givenActiveUser();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());
        when(bodyStatsRepository.saveAndFlush(any(BodyStats.class)))
                .thenAnswer(i -> i.getArgument(0));

        BodyStats saved = savedFromPut(request("175", "cm", "72.5", "kg", 25));

        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getHeightCm()).isEqualByComparingTo("175.0");
        assertThat(saved.getWeightKg()).isEqualByComparingTo("72.5");
        assertThat(saved.getAge()).isEqualTo(25);
        assertThat(saved.getGender()).isEqualTo("MALE");
        assertThat(saved.getActivityLevel()).isEqualTo("MODERATE");
    }

    @Test
    @DisplayName("updates the existing row instead of adding a second one")
    void shouldUpdateExistingRow() {
        givenActiveUser();
        BodyStats existing =
                BodyStats.builder()
                        .id(UUID.randomUUID())
                        .user(user)
                        .heightCm(new BigDecimal("160.0"))
                        .weightKg(new BigDecimal("60.0"))
                        .age(30)
                        .gender("FEMALE")
                        .activityLevel("LIGHT")
                        .build();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.of(existing));
        when(bodyStatsRepository.saveAndFlush(any(BodyStats.class)))
                .thenAnswer(i -> i.getArgument(0));

        BodyStats saved = savedFromPut(request("175", "cm", "72.5", "kg", 25));

        assertThat(saved).isSameAs(existing);
        assertThat(saved.getHeightCm()).isEqualByComparingTo("175.0");
        assertThat(saved.getGender()).isEqualTo("MALE");
        assertThat(saved.getActivityLevel()).isEqualTo("MODERATE");
    }

    @ParameterizedTest(name = "{0} ft -> {1} cm")
    @CsvSource({"5.0, 152.4", "5.75, 175.3", "9.8, 298.7"})
    @DisplayName("converts feet to centimetres rounded to one decimal")
    void shouldConvertFeet(String feet, String expectedCm) {
        givenActiveUser();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());
        when(bodyStatsRepository.saveAndFlush(any(BodyStats.class)))
                .thenAnswer(i -> i.getArgument(0));

        BodyStats saved = savedFromPut(request(feet, "ft", "70", "kg", 25));

        assertThat(saved.getHeightCm()).isEqualByComparingTo(expectedCm);
    }

    @ParameterizedTest(name = "{0} lbs -> {1} kg")
    @CsvSource({"150, 68.0", "160.5, 72.8", "44.1, 20.0"})
    @DisplayName("converts pounds to kilograms rounded to one decimal")
    void shouldConvertPounds(String pounds, String expectedKg) {
        givenActiveUser();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());
        when(bodyStatsRepository.saveAndFlush(any(BodyStats.class)))
                .thenAnswer(i -> i.getArgument(0));

        BodyStats saved = savedFromPut(request("175", "cm", pounds, "lbs", 25));

        assertThat(saved.getWeightKg()).isEqualByComparingTo(expectedKg);
    }

    @ParameterizedTest
    @CsvSource({"50, 20, 13", "300, 300, 120"})
    @DisplayName("accepts values exactly on the boundaries")
    void shouldAcceptBoundaryValues(String height, String weight, int age) {
        givenActiveUser();
        when(bodyStatsRepository.findByUser_Id(USER_ID)).thenReturn(Optional.empty());
        when(bodyStatsRepository.saveAndFlush(any(BodyStats.class)))
                .thenAnswer(i -> i.getArgument(0));

        BodyStats saved = savedFromPut(request(height, "cm", weight, "kg", age));

        assertThat(saved.getHeightCm()).isEqualByComparingTo(height);
        assertThat(saved.getWeightKg()).isEqualByComparingTo(weight);
    }

    @ParameterizedTest
    @CsvSource({
        "49.9, cm, 70, kg",
        "300.1, cm, 70, kg",
        "9.9, ft, 70, kg",
        "175, cm, 19.9, kg",
        "175, cm, 300.1, kg",
        "175, cm, 1000, lbs"
    })
    @DisplayName("rejects height or weight outside the range after conversion")
    void shouldRejectOutOfRange(String height, String hUnit, String weight, String wUnit) {
        givenActiveUser();

        assertThatThrownBy(() -> service.put(USER_ID, request(height, hUnit, weight, wUnit, 25)))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(bodyStatsRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("returns 404 and saves nothing for a deleted or missing user")
    void shouldReturnNotFoundOnPutForMissingUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.put(USER_ID, request("175", "cm", "70", "kg", 25)))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(bodyStatsRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("returns 404 on get for a deleted or missing user")
    void shouldReturnNotFoundOnGetForMissingUser() {
        when(userRepository.findByIdAndDeletedAtIsNull(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(USER_ID))
                .isInstanceOfSatisfying(
                        FuelException.class,
                        e -> assertThat(e.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(bodyStatsRepository, never()).findByUser_Id(any());
    }
}
