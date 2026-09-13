package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.AuthProvider;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService")
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserAuthProviderRepository userAuthProviderRepository;
    @Mock private UserGoalsRepository userGoalsRepository;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private JwtService jwtService;
    @Mock private VerificationCodeService verificationCodeService;

    // Real config holder so the expiry values flow through to the response untouched.
    private final JwtConfig jwtConfig = TestDataFactory.jwtConfig();

    private AuthService authService;

    @Captor private ArgumentCaptor<User> userCaptor;
    @Captor private ArgumentCaptor<UserAuthProvider> authProviderCaptor;
    @Captor private ArgumentCaptor<UserGoals> userGoalsCaptor;

    private UserRegisterRequest request;
    private User persistedUser;

    private static final String ACCESS_TOKEN = "generated.access.token";
    private static final String REFRESH_TOKEN = "generated-refresh-token";

    @BeforeEach
    void setUp() {
        authService =
                new AuthService(
                        userRepository,
                        userAuthProviderRepository,
                        userGoalsRepository,
                        passwordEncoder,
                        refreshTokenService,
                        jwtService,
                        jwtConfig,
                        verificationCodeService);
        request = TestDataFactory.registerRequest();
        persistedUser = TestDataFactory.persistedUser();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    /** Wires the happy-path collaborators; individual tests override as needed. */
    private void stubSuccessfulRegistration() throws Exception {
        when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                .thenReturn(false);
        when(passwordEncoder.encode(TestDataFactory.RAW_PASSWORD))
                .thenReturn(TestDataFactory.HASHED_PASSWORD);
        when(userRepository.save(any(User.class))).thenReturn(persistedUser);
        when(jwtService.generateToken(TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                .thenReturn(ACCESS_TOKEN);
        when(refreshTokenService.issueRefreshToken(persistedUser, null, null))
                .thenReturn(REFRESH_TOKEN);
    }

    @Nested
    @DisplayName("register - success")
    class RegisterSuccess {

        @Test
        @DisplayName("returns a 201 response carrying tokens and user data")
        void returnsCreatedResponse() throws Exception {
            stubSuccessfulRegistration();

            ApiResponse<UserData> response = authService.register(request);

            assertThat(response.getStatus()).isEqualTo(201);
            assertThat(response.getMessage())
                    .isEqualTo("Registration successful. Verification email sent.");

            UserData data = response.getData();
            assertThat(data).isNotNull();
            assertThat(data.getUserId()).isEqualTo(TestDataFactory.USER_ID.toString());
            assertThat(data.getEmail()).isEqualTo(TestDataFactory.EMAIL);
            assertThat(data.getName()).isEqualTo(TestDataFactory.NAME);
            assertThat(data.isEmailVerified()).isFalse();
            assertThat(data.getAccessToken()).isEqualTo(ACCESS_TOKEN);
            assertThat(data.getRefreshToken()).isEqualTo(REFRESH_TOKEN);
            assertThat(data.getAccessTokenExpiresIn())
                    .isEqualTo(TestDataFactory.ACCESS_TOKEN_EXPIRY_SECONDS);
            assertThat(data.getRefreshTokenExpiresIn())
                    .isEqualTo(TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS);
        }

        @Test
        @DisplayName("persists the user with request details and the client-supplied timezone")
        void persistsUserFromRequest() throws Exception {
            stubSuccessfulRegistration();

            authService.register(request);

            verify(userRepository).save(userCaptor.capture());
            User saved = userCaptor.getValue();
            assertThat(saved.getEmail()).isEqualTo(TestDataFactory.EMAIL);
            assertThat(saved.getName()).isEqualTo(TestDataFactory.NAME);
            assertThat(saved.getTimezone()).isEqualTo(TestDataFactory.TIMEZONE);
        }

        @Test
        @DisplayName("falls back to UTC when the request omits a timezone")
        void defaultsToUtcWhenTimezoneMissing() throws Exception {
            stubSuccessfulRegistration();
            request.setTimezone(null);

            authService.register(request);

            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getTimezone()).isEqualTo("UTC");
        }

        @Test
        @DisplayName("persists an EMAIL auth provider with the encoded password")
        void persistsAuthProviderWithHashedPassword() throws Exception {
            stubSuccessfulRegistration();

            authService.register(request);

            verify(userAuthProviderRepository).save(authProviderCaptor.capture());
            UserAuthProvider savedProvider = authProviderCaptor.getValue();
            assertThat(savedProvider.getUser()).isSameAs(persistedUser);
            assertThat(savedProvider.getProvider()).isEqualTo(AuthProvider.EMAIL);
            // The raw password must never be stored; only the encoder output.
            assertThat(savedProvider.getPasswordHash()).isEqualTo(TestDataFactory.HASHED_PASSWORD);
            assertThat(savedProvider.getPasswordHash()).isNotEqualTo(TestDataFactory.RAW_PASSWORD);
            verify(passwordEncoder).encode(TestDataFactory.RAW_PASSWORD);
        }

        @Test
        @DisplayName("creates a default goals row linked to the new user")
        void persistsUserGoals() throws Exception {
            stubSuccessfulRegistration();

            authService.register(request);

            verify(userGoalsRepository).save(userGoalsCaptor.capture());
            assertThat(userGoalsCaptor.getValue().getUser()).isSameAs(persistedUser);
        }

        @Test
        @DisplayName("issues the refresh token with null device and ip metadata")
        void issuesRefreshTokenWithoutMetadata() throws Exception {
            stubSuccessfulRegistration();

            authService.register(request);

            verify(refreshTokenService).issueRefreshToken(persistedUser, null, null);
            verify(jwtService)
                    .generateToken(TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL);
        }
    }

    @Nested
    @DisplayName("register - failures")
    class RegisterFailure {

        @Test
        @DisplayName("throws 409 CONFLICT and persists nothing when the email already exists")
        void throwsConflictWhenEmailExists() {
            when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(true);

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Email already exists")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.CONFLICT);

            verify(userRepository, never()).save(any());
            verifyNoInteractions(
                    userAuthProviderRepository,
                    userGoalsRepository,
                    passwordEncoder,
                    jwtService,
                    refreshTokenService);
        }

        @Test
        @DisplayName("propagates access-token generation failures after the user is persisted")
        void propagatesTokenGenerationFailure() throws Exception {
            when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(false);
            when(passwordEncoder.encode(TestDataFactory.RAW_PASSWORD))
                    .thenReturn(TestDataFactory.HASHED_PASSWORD);
            when(userRepository.save(any(User.class))).thenReturn(persistedUser);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenThrow(new RuntimeException("signing key unavailable"));

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("signing key unavailable");

            // Entities created before token generation should still have been saved.
            verify(userRepository).save(any(User.class));
            verify(userAuthProviderRepository).save(any(UserAuthProvider.class));
            verify(userGoalsRepository).save(any(UserGoals.class));
            // Refresh token is only issued after the access token, so it is never reached.
            verify(refreshTokenService, never()).issueRefreshToken(any(), any(), any());
        }

        @Test
        @DisplayName("propagates refresh-token issuance failures (e.g. downstream 500)")
        void propagatesRefreshTokenFailure() throws Exception {
            when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(false);
            when(passwordEncoder.encode(TestDataFactory.RAW_PASSWORD))
                    .thenReturn(TestDataFactory.HASHED_PASSWORD);
            when(userRepository.save(any(User.class))).thenReturn(persistedUser);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(persistedUser, null, null))
                    .thenThrow(new RuntimeException("refresh store unavailable"));

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("refresh store unavailable");

            verify(userGoalsRepository).save(any(UserGoals.class));
            verify(jwtService)
                    .generateToken(TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("throws 400 BAD_REQUEST for an invalid timezone and persists nothing")
        void throwsBadRequestForInvalidTimezone() {
            when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(false);
            request.setTimezone("Not/AZone");

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid timezone: Not/AZone")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);

            verify(userRepository, never()).save(any());
            verifyNoInteractions(userAuthProviderRepository, userGoalsRepository);
        }

        @Test
        @DisplayName("propagates persistence failures while saving the user")
        void propagatesUserSaveFailure() {
            when(userRepository.existsByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(false);
            when(userRepository.save(any(User.class)))
                    .thenThrow(new RuntimeException("unique constraint violation"));

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("unique constraint violation");

            verify(userAuthProviderRepository, never()).save(any());
            verify(userGoalsRepository, never()).save(any());
            verify(jwtService, never()).generateToken(any(), eq(TestDataFactory.EMAIL));
        }
    }

    @Nested
    @DisplayName("login - success")
    class LoginSuccess {

        @Test
        @DisplayName("returns a 200 response carrying tokens and user data for valid credentials")
        void returnsOkResponse() throws Exception {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(true);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(persistedUser, null, null))
                    .thenReturn(REFRESH_TOKEN);

            ApiResponse<UserData> response = authService.login(loginRequest);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getMessage()).isEqualTo("Login successful.");

            UserData data = response.getData();
            assertThat(data).isNotNull();
            assertThat(data.getUserId()).isEqualTo(TestDataFactory.USER_ID.toString());
            assertThat(data.getEmail()).isEqualTo(TestDataFactory.EMAIL);
            assertThat(data.getName()).isEqualTo(TestDataFactory.NAME);
            assertThat(data.getAccessToken()).isEqualTo(ACCESS_TOKEN);
            assertThat(data.getRefreshToken()).isEqualTo(REFRESH_TOKEN);
            assertThat(data.getAccessTokenExpiresIn())
                    .isEqualTo(TestDataFactory.ACCESS_TOKEN_EXPIRY_SECONDS);
            assertThat(data.getRefreshTokenExpiresIn())
                    .isEqualTo(TestDataFactory.REFRESH_TOKEN_EXPIRY_SECONDS);
        }
    }

    @Nested
    @DisplayName("login - failures")
    class LoginFailure {

        @Test
        @DisplayName("throws 401 UNAUTHORIZED when no user exists for the given email")
        void throwsUnauthorizedWhenUserNotFound() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(
                    userAuthProviderRepository, passwordEncoder, jwtService, refreshTokenService);
        }

        @Test
        @DisplayName(
                "throws 401 UNAUTHORIZED when the user has no EMAIL auth provider (e.g."
                        + " Google-only account)")
        void throwsUnauthorizedWhenEmailProviderMissing() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(null);

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(passwordEncoder, jwtService, refreshTokenService);
        }

        @Test
        @DisplayName("throws 401 UNAUTHORIZED when the password does not match")
        void throwsUnauthorizedWhenPasswordDoesNotMatch() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(false);

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(jwtService, refreshTokenService);
        }

        @Test
        @DisplayName("propagates access-token generation failures after credentials are verified")
        void propagatesTokenGenerationFailure() throws Exception {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(true);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenThrow(new RuntimeException("signing key unavailable"));

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("signing key unavailable");

            verify(refreshTokenService, never()).issueRefreshToken(any(), any(), any());
        }

        @Test
        @DisplayName("propagates refresh-token issuance failures (e.g. downstream 500)")
        void propagatesRefreshTokenFailure() throws Exception {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(true);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(persistedUser, null, null))
                    .thenThrow(new RuntimeException("refresh store unavailable"));

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("refresh store unavailable");
        }
    }

    @Nested
    @DisplayName("logout")
    class Logout {

        private static final String RAW_REFRESH_TOKEN = "raw-refresh-token";

        private void authenticateAs(UUID userId) {
            SecurityContextHolder.getContext()
                    .setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    userId.toString(), null, java.util.List.of()));
        }

        @Test
        @DisplayName("revokes the caller's refresh token and returns a 200 response")
        void revokesRefreshTokenForAuthenticatedUser() throws Exception {
            authenticateAs(TestDataFactory.USER_ID);
            LogoutRequest logoutRequest =
                    LogoutRequest.builder().refreshToken(RAW_REFRESH_TOKEN).build();

            ApiResponse<Void> response = authService.logout(logoutRequest);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getMessage()).isEqualTo("Logout successful.");
            verify(refreshTokenService).revokeForUser(RAW_REFRESH_TOKEN, TestDataFactory.USER_ID);
        }

        @Test
        @DisplayName("scopes revocation to the authenticated user's id, not just the token")
        void doesNotRevokeForADifferentUser() throws Exception {
            UUID otherUserId = UUID.fromString("22222222-2222-2222-2222-222222222222");
            authenticateAs(otherUserId);
            LogoutRequest logoutRequest =
                    LogoutRequest.builder().refreshToken(RAW_REFRESH_TOKEN).build();

            authService.logout(logoutRequest);

            verify(refreshTokenService).revokeForUser(RAW_REFRESH_TOKEN, otherUserId);
            verify(refreshTokenService, never())
                    .revokeForUser(RAW_REFRESH_TOKEN, TestDataFactory.USER_ID);
        }

        @Test
        @DisplayName("propagates failures from the underlying revoke call")
        void propagatesRevokeFailure() throws Exception {
            authenticateAs(TestDataFactory.USER_ID);
            LogoutRequest logoutRequest =
                    LogoutRequest.builder().refreshToken(RAW_REFRESH_TOKEN).build();
            org.mockito.Mockito.doThrow(new RuntimeException("token store unavailable"))
                    .when(refreshTokenService)
                    .revokeForUser(RAW_REFRESH_TOKEN, TestDataFactory.USER_ID);

            assertThatThrownBy(() -> authService.logout(logoutRequest))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("token store unavailable");
        }
    }
}
