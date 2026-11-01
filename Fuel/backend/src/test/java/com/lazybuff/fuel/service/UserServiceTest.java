package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService")
class UserServiceTest {

    private static final OffsetDateTime CREATED_AT =
            OffsetDateTime.of(2026, 6, 1, 10, 0, 0, 0, ZoneOffset.UTC);
    private static final String PHOTO_URL = "https://storage.fuel.app/photos/u.jpg";

    @Mock private UserRepository userRepository;
    @Mock private UserAuthProviderRepository userAuthProviderRepository;

    private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, userAuthProviderRepository);
        user = TestDataFactory.persistedUser();
        user.setEmailVerified(true);
        user.setTimezone(TestDataFactory.TIMEZONE);
        user.setProfilePhotoUrl(PHOTO_URL);
        user.setCreatedAt(CREATED_AT);
    }

    @Test
    @DisplayName("returns the profile with the provider the user originally registered with")
    void shouldReturnProfileWithOriginalProvider() {
        when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                .thenReturn(Optional.of(user));
        when(userAuthProviderRepository.findFirstByUser_IdOrderByCreatedAtAsc(
                        TestDataFactory.USER_ID))
                .thenReturn(Optional.of(TestDataFactory.emailAuthProvider(user)));

        ApiResponse<UserProfile> response = userService.getProfile(TestDataFactory.USER_ID);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        assertThat(response.getData())
                .isEqualTo(
                        new UserProfile(
                                TestDataFactory.USER_ID.toString(),
                                TestDataFactory.EMAIL,
                                TestDataFactory.NAME,
                                PHOTO_URL,
                                true,
                                AuthProvider.EMAIL,
                                TestDataFactory.TIMEZONE,
                                CREATED_AT));
    }

    @Test
    @DisplayName("reports GOOGLE for a user who signed up with Google")
    void shouldReportGoogleProvider() {
        when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                .thenReturn(Optional.of(user));
        when(userAuthProviderRepository.findFirstByUser_IdOrderByCreatedAtAsc(
                        TestDataFactory.USER_ID))
                .thenReturn(
                        Optional.of(
                                UserAuthProvider.builder()
                                        .user(user)
                                        .provider(AuthProvider.GOOGLE)
                                        .providerId("109876543210")
                                        .build()));

        ApiResponse<UserProfile> response = userService.getProfile(TestDataFactory.USER_ID);

        assertThat(response.getData().authProvider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    @DisplayName("returns 404 when the user no longer exists")
    void shouldReturnNotFoundWhenUserMissing() {
        when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getProfile(TestDataFactory.USER_ID))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.NOT_FOUND);
        verifyNoInteractions(userAuthProviderRepository);
    }
}
