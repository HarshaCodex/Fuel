package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.OAuthGoogleRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import com.lazybuff.fuel.security.GoogleIdentity;
import com.lazybuff.fuel.util.AuthProvider;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleOAuthService")
class GoogleOAuthServiceTest {

    private static final String ID_TOKEN = "google.id.token";
    private static final String GOOGLE_SUB = "109876543210";
    private static final String ACCESS_TOKEN = "generated.access.token";
    private static final String REFRESH_TOKEN = "generated-refresh-token";

    @Mock private GoogleIdTokenVerifier googleIdTokenVerifier;
    @Mock private UserRepository userRepository;
    @Mock private UserAuthProviderRepository userAuthProviderRepository;
    @Mock private UserGoalsRepository userGoalsRepository;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private JwtService jwtService;

    @Captor private ArgumentCaptor<User> userCaptor;
    @Captor private ArgumentCaptor<UserAuthProvider> authProviderCaptor;

    private GoogleOAuthService googleOAuthService;

    private User persistedUser;

    private final OAuthGoogleRequest request = new OAuthGoogleRequest(ID_TOKEN);

    @BeforeEach
    void setUp() {
        googleOAuthService =
                new GoogleOAuthService(
                        googleIdTokenVerifier,
                        userRepository,
                        userAuthProviderRepository,
                        userGoalsRepository,
                        refreshTokenService,
                        jwtService,
                        TestDataFactory.jwtConfig());
        persistedUser = TestDataFactory.persistedUser();
    }

    private void stubIdentity(String name) {
        when(googleIdTokenVerifier.verify(ID_TOKEN))
                .thenReturn(new GoogleIdentity(GOOGLE_SUB, TestDataFactory.EMAIL, name));
    }

    private void stubNoLinkedGoogleAccount() {
        when(userAuthProviderRepository.findByProviderAndProviderIdAndUser_DeletedAtIsNull(
                        AuthProvider.GOOGLE, GOOGLE_SUB))
                .thenReturn(Optional.empty());
    }

    private void stubTokens() throws Exception {
        when(jwtService.generateToken(TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                .thenReturn(ACCESS_TOKEN);
        when(refreshTokenService.issueRefreshToken(
                        any(User.class),
                        eq(TestDataFactory.DEVICE_INFO),
                        eq(TestDataFactory.IP_ADDRESS)))
                .thenReturn(REFRESH_TOKEN);
    }

    private UserAuthProvider googleProvider(User user) {
        return UserAuthProvider.builder()
                .id(UUID.randomUUID())
                .user(user)
                .provider(AuthProvider.GOOGLE)
                .providerId(GOOGLE_SUB)
                .build();
    }

    @Test
    @DisplayName("logs in the user already linked to the Google account")
    void shouldLogInLinkedUser() throws Exception {
        stubIdentity(TestDataFactory.NAME);
        when(userAuthProviderRepository.findByProviderAndProviderIdAndUser_DeletedAtIsNull(
                        AuthProvider.GOOGLE, GOOGLE_SUB))
                .thenReturn(Optional.of(googleProvider(persistedUser)));
        stubTokens();

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
        assertThat(response.getData().getUserId()).isEqualTo(TestDataFactory.USER_ID.toString());
        assertThat(response.getData().getIsNewUser()).isFalse();
        assertThat(response.getData().getAccessToken()).isEqualTo(ACCESS_TOKEN);
        assertThat(response.getData().getRefreshToken()).isEqualTo(REFRESH_TOKEN);
        verify(userRepository, never()).save(any());
        verify(userAuthProviderRepository, never()).save(any());
    }

    @Test
    @DisplayName("creates a verified user with a Google provider when none exists")
    void shouldCreateUserWhenNoAccountExists() throws Exception {
        stubIdentity(TestDataFactory.NAME);
        stubNoLinkedGoogleAccount();
        when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL)).thenReturn(null);
        when(userRepository.save(any(User.class))).thenReturn(persistedUser);
        stubTokens();

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getEmail()).isEqualTo(TestDataFactory.EMAIL);
        assertThat(userCaptor.getValue().getName()).isEqualTo(TestDataFactory.NAME);
        assertThat(userCaptor.getValue().isEmailVerified()).isTrue();
        verify(userAuthProviderRepository).save(authProviderCaptor.capture());
        assertThat(authProviderCaptor.getValue().getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(authProviderCaptor.getValue().getProviderId()).isEqualTo(GOOGLE_SUB);
        assertThat(authProviderCaptor.getValue().getPasswordHash()).isNull();
        verify(userGoalsRepository).save(any(UserGoals.class));
        assertThat(response.getData().getIsNewUser()).isTrue();
    }

    @Test
    @DisplayName("falls back to the email's local part when Google sends no name")
    void shouldFallBackToEmailLocalPartForName() throws Exception {
        stubIdentity(null);
        stubNoLinkedGoogleAccount();
        when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL)).thenReturn(null);
        when(userRepository.save(any(User.class))).thenReturn(persistedUser);
        stubTokens();

        googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getName()).isEqualTo("john.doe");
    }

    @Test
    @DisplayName("links Google to a verified email account and keeps its password")
    void shouldLinkToVerifiedEmailAccount() throws Exception {
        persistedUser.setEmailVerified(true);
        stubIdentity(TestDataFactory.NAME);
        stubNoLinkedGoogleAccount();
        when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                .thenReturn(persistedUser);
        when(userAuthProviderRepository.findByUser_IdAndProvider(
                        TestDataFactory.USER_ID, AuthProvider.GOOGLE))
                .thenReturn(null);
        stubTokens();

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        verify(userAuthProviderRepository).save(authProviderCaptor.capture());
        assertThat(authProviderCaptor.getValue().getUser()).isSameAs(persistedUser);
        assertThat(authProviderCaptor.getValue().getProviderId()).isEqualTo(GOOGLE_SUB);
        verify(userAuthProviderRepository, never()).delete(any());
        verify(refreshTokenService, never()).revokeAll(any());
        assertThat(response.getData().getIsNewUser()).isFalse();
    }

    @Test
    @DisplayName("drops the unproven password and sessions when linking an unverified account")
    void shouldDropUnverifiedPasswordWhenLinking() throws Exception {
        UserAuthProvider emailProvider = TestDataFactory.emailAuthProvider(persistedUser);
        stubIdentity(TestDataFactory.NAME);
        stubNoLinkedGoogleAccount();
        when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                .thenReturn(persistedUser);
        when(userAuthProviderRepository.findByUser_IdAndProvider(
                        TestDataFactory.USER_ID, AuthProvider.GOOGLE))
                .thenReturn(null);
        when(userAuthProviderRepository.findByUser_IdAndProvider(
                        TestDataFactory.USER_ID, AuthProvider.EMAIL))
                .thenReturn(emailProvider);
        stubTokens();

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        verify(userAuthProviderRepository).delete(emailProvider);
        verify(refreshTokenService).revokeAll(TestDataFactory.USER_ID);
        assertThat(persistedUser.isEmailVerified()).isTrue();
        verify(userRepository).save(persistedUser);
        assertThat(response.getData().isEmailVerified()).isTrue();
    }

    @Test
    @DisplayName("rejects linking when the account already has a different Google account")
    void shouldRejectWhenAccountLinkedToDifferentGoogleAccount() {
        stubIdentity(TestDataFactory.NAME);
        stubNoLinkedGoogleAccount();
        when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                .thenReturn(persistedUser);
        when(userAuthProviderRepository.findByUser_IdAndProvider(
                        TestDataFactory.USER_ID, AuthProvider.GOOGLE))
                .thenReturn(googleProvider(persistedUser));

        assertThatThrownBy(
                        () -> googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(userAuthProviderRepository, never()).save(any());
    }

    @Test
    @DisplayName("propagates verification failures without touching the database")
    void shouldPropagateVerificationFailure() {
        when(googleIdTokenVerifier.verify(ID_TOKEN))
                .thenThrow(new FuelException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token"));

        assertThatThrownBy(
                        () -> googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(userRepository, userAuthProviderRepository, refreshTokenService);
    }
}
