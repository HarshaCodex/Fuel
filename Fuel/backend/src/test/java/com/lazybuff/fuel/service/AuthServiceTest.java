package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.config.RateLimitConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.ResetPasswordRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.RefreshTokenRepository;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.AuthProvider;
import com.lazybuff.fuel.util.VerifyType;
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

    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserAuthProviderRepository userAuthProviderRepository;
    @Mock private UserGoalsRepository userGoalsRepository;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private JwtService jwtService;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private EmailService emailService;
    @Mock private RateLimiterService rateLimiterService;

    private final RateLimitConfig rateLimitConfig = rateLimitConfig();

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
                        refreshTokenRepository,
                        userRepository,
                        userAuthProviderRepository,
                        userGoalsRepository,
                        passwordEncoder,
                        refreshTokenService,
                        jwtService,
                        jwtConfig,
                        verificationCodeService,
                        emailService,
                        rateLimiterService,
                        rateLimitConfig);
        request = TestDataFactory.registerRequest();
        persistedUser = TestDataFactory.persistedUser();
    }

    private static RateLimitConfig rateLimitConfig() {
        RateLimitConfig config = new RateLimitConfig();
        config.setMaxRequests(3);
        config.setWindow(java.time.Duration.ofHours(1));
        return config;
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    /** Wires the happy-path collaborators for a new email; individual tests override as needed. */
    private void stubSuccessfulRegistration() {
        when(passwordEncoder.encode(TestDataFactory.RAW_PASSWORD))
                .thenReturn(TestDataFactory.HASHED_PASSWORD);
        when(userRepository.save(any(User.class))).thenReturn(persistedUser);
    }

    private void stubSignIn() throws Exception {
        when(jwtService.generateToken(TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                .thenReturn(ACCESS_TOKEN);
        when(refreshTokenService.issueRefreshToken(
                        persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                .thenReturn(REFRESH_TOKEN);
    }

    private static void assertSignedIn(UserData data) {
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

    @Nested
    @DisplayName("register - new email")
    class RegisterNewEmail {

        @Test
        @DisplayName("returns 202 \"check your email\" with no tokens or user data")
        void returnsAcceptedWithoutSigningIn() throws Exception {
            stubSuccessfulRegistration();

            ApiResponse<Void> response = authService.register(request);

            assertThat(response.getStatus()).isEqualTo(202);
            assertThat(response.getMessage()).startsWith("Check your email");
            assertThat(response.getData()).isNull();
            verifyNoInteractions(jwtService, refreshTokenService);
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
            verify(passwordEncoder).encode(TestDataFactory.RAW_PASSWORD);
        }

        @Test
        @DisplayName("creates a default goals row and emails a verification code")
        void persistsGoalsAndSendsCode() throws Exception {
            stubSuccessfulRegistration();

            authService.register(request);

            verify(userGoalsRepository).save(userGoalsCaptor.capture());
            assertThat(userGoalsCaptor.getValue().getUser()).isSameAs(persistedUser);
            verify(verificationCodeService)
                    .generateVerificationCode(persistedUser, VerifyType.EMAIL_VERIFY);
            verifyNoInteractions(emailService);
        }
    }

    @Nested
    @DisplayName("register - taken email")
    class RegisterTakenEmail {

        @BeforeEach
        void emailIsTaken() {
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
        }

        @Test
        @DisplayName("returns the same 202 response as a new email")
        void returnsSameResponseAsNewEmail() throws Exception {
            ApiResponse<Void> response = authService.register(request);

            assertThat(response.getStatus()).isEqualTo(202);
            assertThat(response.getMessage()).startsWith("Check your email");
            assertThat(response.getData()).isNull();
        }

        @Test
        @DisplayName("hashes the password anyway, so it takes as long as a new sign-up")
        void hashesPasswordForEqualTiming() throws Exception {
            authService.register(request);

            verify(passwordEncoder).encode(TestDataFactory.RAW_PASSWORD);
        }

        @Test
        @DisplayName("emails the owner a notice and changes nothing")
        void notifiesOwnerWithoutChanges() throws Exception {
            when(rateLimiterService.isAllowed(any(), anyInt(), any())).thenReturn(true);

            authService.register(request);

            verify(emailService).sendAccountExistsEmail(TestDataFactory.EMAIL);
            verify(userRepository, never()).save(any());
            verifyNoInteractions(
                    userAuthProviderRepository,
                    userGoalsRepository,
                    verificationCodeService,
                    jwtService,
                    refreshTokenService);
        }

        @Test
        @DisplayName("caps notices per account by user id, with the per-email limit")
        void capsNoticesPerAccount() throws Exception {
            authService.register(request);

            verify(rateLimiterService)
                    .isAllowed(
                            "rate_limit:account-exists-notice:" + TestDataFactory.USER_ID,
                            rateLimitConfig.getMaxRequests(),
                            rateLimitConfig.getWindow());
        }

        @Test
        @DisplayName("skips the notice over the cap instead of returning 429")
        void skipsNoticeOverCap() throws Exception {
            when(rateLimiterService.isAllowed(any(), anyInt(), any())).thenReturn(false);

            ApiResponse<Void> response = authService.register(request);

            assertThat(response.getStatus()).isEqualTo(202);
            verifyNoInteractions(emailService);
        }
    }

    @Nested
    @DisplayName("register - failures")
    class RegisterFailure {

        @Test
        @DisplayName("throws 400 for an invalid timezone before checking whether the email exists")
        void throwsBadRequestForInvalidTimezone() {
            request.setTimezone("Not/AZone");

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid timezone: Not/AZone")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.BAD_REQUEST);

            // Checked first, so a taken email can't answer differently from a new one.
            verifyNoInteractions(userRepository, userAuthProviderRepository, userGoalsRepository);
        }

        @Test
        @DisplayName("propagates persistence failures while saving the user")
        void propagatesUserSaveFailure() {
            when(userRepository.save(any(User.class)))
                    .thenThrow(new RuntimeException("unique constraint violation"));

            assertThatThrownBy(() -> authService.register(request))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("unique constraint violation");

            verify(userAuthProviderRepository, never()).save(any());
            verify(userGoalsRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("verifyEmail")
    class VerifyEmail {

        private final VerifyEmailRequest verifyRequest =
                VerifyEmailRequest.builder()
                        .email(TestDataFactory.EMAIL)
                        .verificationCode(TestDataFactory.VALID_CODE)
                        .build();

        @Test
        @DisplayName("signs the user in once the code is confirmed")
        void signsInAfterConfirmation() throws Exception {
            persistedUser.setEmailVerified(true);
            when(verificationCodeService.confirmEmail(verifyRequest)).thenReturn(persistedUser);
            stubSignIn();

            ApiResponse<UserData> response =
                    authService.verifyEmail(verifyRequest, TestDataFactory.CLIENT_INFO);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getMessage()).isEqualTo("Email verified successfully");
            assertSignedIn(response.getData());
            assertThat(response.getData().isEmailVerified()).isTrue();
        }

        @Test
        @DisplayName("issues no tokens when the code is rejected")
        void issuesNoTokensWhenRejected() throws Exception {
            when(verificationCodeService.confirmEmail(verifyRequest))
                    .thenThrow(
                            new FuelException(
                                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                                    "Invalid or expired verification code"));

            assertThatThrownBy(
                            () ->
                                    authService.verifyEmail(
                                            verifyRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class);

            verifyNoInteractions(jwtService, refreshTokenService);
        }
    }

    @Nested
    @DisplayName("login - success")
    class LoginSuccess {

        @Test
        @DisplayName("returns a 200 response carrying tokens and user data for valid credentials")
        void returnsOkResponse() throws Exception {
            persistedUser.setEmailVerified(true);
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
            when(refreshTokenService.issueRefreshToken(
                            persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                    .thenReturn(REFRESH_TOKEN);

            ApiResponse<UserData> response =
                    authService.login(loginRequest, TestDataFactory.CLIENT_INFO);

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

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(userAuthProviderRepository, jwtService, refreshTokenService);
        }

        @Test
        @DisplayName("runs bcrypt against a dummy hash for an unknown email, so timing matches")
        void checksDummyHashWhenUserNotFound() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(passwordEncoder.encode(any())).thenReturn("dummy-hash");

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class);

            verify(passwordEncoder).matches(TestDataFactory.RAW_PASSWORD, "dummy-hash");
        }

        @Test
        @DisplayName("creates the dummy hash once and reuses it")
        void reusesDummyHash() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(passwordEncoder.encode(any())).thenReturn("dummy-hash");

            for (int i = 0; i < 2; i++) {
                assertThatThrownBy(
                                () -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                        .isInstanceOf(FuelException.class);
            }

            verify(passwordEncoder, times(1)).encode(any());
            verify(passwordEncoder, times(2)).matches(TestDataFactory.RAW_PASSWORD, "dummy-hash");
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

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            // Still runs bcrypt (against the dummy hash) so this takes as long as a wrong password.
            verify(passwordEncoder).matches(any(), any());
            verifyNoInteractions(jwtService, refreshTokenService);
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

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(jwtService, refreshTokenService);
        }

        @Test
        @DisplayName("throws 403 for the right password on an unverified account")
        void throwsForbiddenWhenEmailNotVerified() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(TestDataFactory.emailAuthProvider(persistedUser));
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(true);

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Please verify your email before logging in.")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN);

            verifyNoInteractions(jwtService, refreshTokenService);
        }

        @Test
        @DisplayName(
                "throws the generic 401, not 403, for a wrong password on an unverified account")
        void throwsUnauthorizedForWrongPasswordWhenUnverified() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(TestDataFactory.emailAuthProvider(persistedUser));

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid email or password!");
        }

        @Test
        @DisplayName("propagates access-token generation failures after credentials are verified")
        void propagatesTokenGenerationFailure() throws Exception {
            persistedUser.setEmailVerified(true);
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

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("signing key unavailable");

            verify(refreshTokenService, never()).issueRefreshToken(any(), any(), any());
        }

        @Test
        @DisplayName("propagates refresh-token issuance failures (e.g. downstream 500)")
        void propagatesRefreshTokenFailure() throws Exception {
            persistedUser.setEmailVerified(true);
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
            when(refreshTokenService.issueRefreshToken(
                            persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                    .thenThrow(new RuntimeException("refresh store unavailable"));

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
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

    @Nested
    @DisplayName("refreshToken")
    class RefreshToken {

        private static final String RAW_REFRESH_TOKEN = "raw-refresh-token";

        private void authenticateAs(UUID userId) {
            SecurityContextHolder.getContext()
                    .setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    userId.toString(), null, java.util.List.of()));
        }

        @Test
        @DisplayName("rotates the token and returns fresh tokens for its owner")
        void returnsOkResponseForValidToken() throws Exception {
            com.lazybuff.fuel.dto.RefreshTokenRequest request =
                    com.lazybuff.fuel.dto.RefreshTokenRequest.builder()
                            .refreshToken(RAW_REFRESH_TOKEN)
                            .build();
            when(refreshTokenService.rotate(RAW_REFRESH_TOKEN, null)).thenReturn(persistedUser);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(
                            persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                    .thenReturn(REFRESH_TOKEN);

            ApiResponse<com.lazybuff.fuel.dto.RefreshTokenResponse> response =
                    authService.refreshToken(request, TestDataFactory.CLIENT_INFO);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getMessage()).isEqualTo("Token refreshed");
            assertThat(response.getData().getAccessToken()).isEqualTo(ACCESS_TOKEN);
            assertThat(response.getData().getRefreshToken()).isEqualTo(REFRESH_TOKEN);
        }

        @Test
        @DisplayName("does not require an authenticated caller to rotate the token")
        void worksWithoutAnAccessToken() throws Exception {
            com.lazybuff.fuel.dto.RefreshTokenRequest request =
                    com.lazybuff.fuel.dto.RefreshTokenRequest.builder()
                            .refreshToken(RAW_REFRESH_TOKEN)
                            .build();
            when(refreshTokenService.rotate(RAW_REFRESH_TOKEN, null)).thenReturn(persistedUser);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(
                            persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                    .thenReturn(REFRESH_TOKEN);

            authService.refreshToken(request, TestDataFactory.CLIENT_INFO);

            verify(refreshTokenService).rotate(RAW_REFRESH_TOKEN, null);
        }

        @Test
        @DisplayName("passes the caller's id through when an access token is present")
        void passesCallerIdWhenAuthenticated() throws Exception {
            authenticateAs(TestDataFactory.USER_ID);
            com.lazybuff.fuel.dto.RefreshTokenRequest request =
                    com.lazybuff.fuel.dto.RefreshTokenRequest.builder()
                            .refreshToken(RAW_REFRESH_TOKEN)
                            .build();
            when(refreshTokenService.rotate(RAW_REFRESH_TOKEN, TestDataFactory.USER_ID))
                    .thenReturn(persistedUser);
            when(jwtService.generateToken(
                            TestDataFactory.USER_ID.toString(), TestDataFactory.EMAIL))
                    .thenReturn(ACCESS_TOKEN);
            when(refreshTokenService.issueRefreshToken(
                            persistedUser, TestDataFactory.DEVICE_INFO, TestDataFactory.IP_ADDRESS))
                    .thenReturn(REFRESH_TOKEN);

            authService.refreshToken(request, TestDataFactory.CLIENT_INFO);

            verify(refreshTokenService).rotate(RAW_REFRESH_TOKEN, TestDataFactory.USER_ID);
        }

        @Test
        @DisplayName("propagates the 401 thrown by rotate for an unknown or expired token")
        void propagatesRotateFailure() throws Exception {
            com.lazybuff.fuel.dto.RefreshTokenRequest request =
                    com.lazybuff.fuel.dto.RefreshTokenRequest.builder()
                            .refreshToken(RAW_REFRESH_TOKEN)
                            .build();
            when(refreshTokenService.rotate(RAW_REFRESH_TOKEN, null))
                    .thenThrow(
                            new FuelException(
                                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                                    "Refresh token invalid, expired or revoked"));

            assertThatThrownBy(() -> authService.refreshToken(request, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Refresh token invalid, expired or revoked");

            verify(refreshTokenService, never()).issueRefreshToken(any(), any(), any());
        }
    }

    @Nested
    @DisplayName("resetPassword - success")
    class ResetPasswordSuccess {

        @Test
        @DisplayName(
                "returns a 200 response, re-hashes the password, consumes the code, and"
                        + " revokes existing refresh tokens")
        void resetsPasswordAndRevokesSessions() throws Exception {
            persistedUser.setEmailVerified(true);
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);
            VerificationCode code = TestDataFactory.validPasswordResetCode(persistedUser);
            ResetPasswordRequest request = TestDataFactory.resetPasswordRequest();

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(verificationCodeService.findValidCode(
                            persistedUser, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE))
                    .thenReturn(code);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.encode(TestDataFactory.NEW_PASSWORD))
                    .thenReturn("hashed-new-password");

            ApiResponse<Void> response = authService.resetPassword(request);

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getMessage())
                    .isEqualTo("Password reset successful. Please log in with your new password.");

            assertThat(authProvider.getPasswordHash()).isEqualTo("hashed-new-password");
            assertThat(code.getUsedAt()).isNotNull();
            verify(refreshTokenRepository).deleteByUser_Id(TestDataFactory.USER_ID);
            verify(userAuthProviderRepository, never()).save(any());
        }

        @Test
        @DisplayName("works for an unverified account and marks the email verified")
        void verifiesEmailOnReset() throws Exception {
            persistedUser.setEmailVerified(false);
            UserAuthProvider authProvider = TestDataFactory.emailAuthProvider(persistedUser);
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(verificationCodeService.findValidCode(
                            persistedUser, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE))
                    .thenReturn(TestDataFactory.validPasswordResetCode(persistedUser));
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(authProvider);
            when(passwordEncoder.encode(TestDataFactory.NEW_PASSWORD))
                    .thenReturn("hashed-new-password");

            ApiResponse<Void> response =
                    authService.resetPassword(TestDataFactory.resetPasswordRequest());

            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(persistedUser.isEmailVerified()).isTrue();
            // Replaces the password of whoever registered the email, and ends their sessions.
            assertThat(authProvider.getPasswordHash()).isEqualTo("hashed-new-password");
            verify(refreshTokenRepository).deleteByUser_Id(TestDataFactory.USER_ID);
        }

        @Test
        @DisplayName("adds an email/password login for a Google-only account instead of failing")
        void addsPasswordLoginForGoogleOnlyAccount() throws Exception {
            persistedUser.setEmailVerified(true);
            VerificationCode code = TestDataFactory.validPasswordResetCode(persistedUser);
            ResetPasswordRequest request = TestDataFactory.resetPasswordRequest();

            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(verificationCodeService.findValidCode(
                            persistedUser, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE))
                    .thenReturn(code);
            when(userAuthProviderRepository.findByUser_IdAndProvider(
                            TestDataFactory.USER_ID, AuthProvider.EMAIL))
                    .thenReturn(null);
            when(passwordEncoder.encode(TestDataFactory.NEW_PASSWORD))
                    .thenReturn("hashed-new-password");

            ApiResponse<Void> response = authService.resetPassword(request);

            assertThat(response.getStatus()).isEqualTo(200);
            verify(userAuthProviderRepository).save(authProviderCaptor.capture());
            UserAuthProvider added = authProviderCaptor.getValue();
            assertThat(added.getUser()).isSameAs(persistedUser);
            assertThat(added.getProvider()).isEqualTo(AuthProvider.EMAIL);
            assertThat(added.getPasswordHash()).isEqualTo("hashed-new-password");
            // The Google link is left alone; only the email provider is added.
            verify(userAuthProviderRepository, never()).delete(any());
            assertThat(code.getUsedAt()).isNotNull();
            verify(refreshTokenRepository).deleteByUser_Id(TestDataFactory.USER_ID);
        }
    }

    @Nested
    @DisplayName("resetPassword - failures")
    class ResetPasswordFailure {

        @Test
        @DisplayName("throws 401 UNAUTHORIZED when no user exists for the given email")
        void throwsUnauthorizedWhenUserNotFound() {
            ResetPasswordRequest request = TestDataFactory.resetPasswordRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(null);

            assertThatThrownBy(() -> authService.resetPassword(request))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code")
                    .extracting(ex -> ((FuelException) ex).getHttpStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.UNAUTHORIZED);

            verifyNoInteractions(verificationCodeService, userAuthProviderRepository);
        }

        @Test
        @DisplayName("propagates a rejected code without changing the password or sessions")
        void propagatesRejectedCode() throws Exception {
            persistedUser.setEmailVerified(true);
            ResetPasswordRequest request = TestDataFactory.resetPasswordRequest();
            when(userRepository.findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL))
                    .thenReturn(persistedUser);
            when(verificationCodeService.findValidCode(
                            persistedUser, VerifyType.PASSWORD_RESET, TestDataFactory.VALID_CODE))
                    .thenThrow(
                            new FuelException(
                                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                                    "Invalid or expired verification code"));

            assertThatThrownBy(() -> authService.resetPassword(request))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid or expired verification code");

            verifyNoInteractions(userAuthProviderRepository, refreshTokenRepository);
        }
    }

    @Nested
    @DisplayName("email normalisation")
    class EmailNormalisation {

        private static final String MIXED_CASE_EMAIL = "  John.Doe@Example.COM ";

        @Test
        @DisplayName("register checks and stores the lower-cased email")
        void shouldStoreLowercaseEmailOnRegister() throws Exception {
            request.setEmail(MIXED_CASE_EMAIL);
            stubSuccessfulRegistration();

            authService.register(request);

            verify(userRepository).findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL);
            verify(userRepository).save(userCaptor.capture());
            assertThat(userCaptor.getValue().getEmail()).isEqualTo(TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("login looks the account up by the lower-cased email")
        void shouldLookUpLowercaseEmailOnLogin() {
            LoginReqeust loginRequest = TestDataFactory.loginRequest();
            loginRequest.setEmail(MIXED_CASE_EMAIL);

            assertThatThrownBy(() -> authService.login(loginRequest, TestDataFactory.CLIENT_INFO))
                    .isInstanceOf(FuelException.class);

            verify(userRepository).findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL);
        }

        @Test
        @DisplayName("resetPassword looks the account up by the lower-cased email")
        void shouldLookUpLowercaseEmailOnResetPassword() {
            ResetPasswordRequest resetRequest = TestDataFactory.resetPasswordRequest();
            resetRequest.setEmail(MIXED_CASE_EMAIL);

            assertThatThrownBy(() -> authService.resetPassword(resetRequest))
                    .isInstanceOf(FuelException.class);

            verify(userRepository).findByEmailAndDeletedAtIsNull(TestDataFactory.EMAIL);
        }
    }
}
