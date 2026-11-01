package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.config.AccountDeletionConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DeleteAccountRequest;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.exception.RateLimitExceededException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.security.AppleIdTokenVerifier;
import com.lazybuff.fuel.security.AppleTokenRevoker;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import com.lazybuff.fuel.security.OAuthIdentity;
import com.lazybuff.fuel.security.VerifiedAppleToken;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService")
class UserServiceTest {

    private static final OffsetDateTime CREATED_AT =
            OffsetDateTime.of(2026, 6, 1, 10, 0, 0, 0, ZoneOffset.UTC);
    private static final String PHOTO_URL = "https://storage.fuel.app/photos/u.jpg";

    @Mock private UserRepository userRepository;
    @Mock private UserAuthProviderRepository userAuthProviderRepository;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private RateLimiterService rateLimiterService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private GoogleIdTokenVerifier googleIdTokenVerifier;
    @Mock private AppleIdTokenVerifier appleIdTokenVerifier;
    @Mock private AppleTokenRevoker appleTokenRevoker;

    private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        userService =
                new UserService(
                        userRepository,
                        userAuthProviderRepository,
                        refreshTokenService,
                        rateLimiterService,
                        passwordEncoder,
                        googleIdTokenVerifier,
                        appleIdTokenVerifier,
                        new AccountDeletionConfig(),
                        appleTokenRevoker);
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

    @Nested
    @DisplayName("deleteAccount")
    class DeleteAccount {

        private static final String GOOGLE_SUB = "109876543210";
        private static final String APPLE_SUB = "001234.abcdef.1234";

        private UserAuthProvider oauthProvider(AuthProvider type, String subject) {
            return UserAuthProvider.builder()
                    .id(UUID.randomUUID())
                    .user(user)
                    .provider(type)
                    .providerId(subject)
                    .build();
        }

        private void stubActiveUserWith(UserAuthProvider... providers) {
            when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                    .thenReturn(Optional.of(user));
            when(userAuthProviderRepository.findByUser_Id(TestDataFactory.USER_ID))
                    .thenReturn(List.of(providers));
        }

        private void assertDeleted(List<UserAuthProvider> providers) {
            assertThat(user.getDeletedAt()).isNotNull();
            verify(userRepository).save(user);
            verify(userAuthProviderRepository).deleteAll(providers);
            verify(refreshTokenService).revokeAll(TestDataFactory.USER_ID);
        }

        private void assertNotDeleted() {
            assertThat(user.getDeletedAt()).isNull();
            verify(userRepository, never()).save(any());
            verify(userAuthProviderRepository, never()).deleteAll(any());
            verifyNoInteractions(refreshTokenService);
        }

        private DeleteAccountRequest withPassword(String password) {
            return DeleteAccountRequest.builder().password(password).build();
        }

        @Test
        @DisplayName(
                "soft-deletes the account and removes sign-ins and sessions for the right password")
        void shouldDeleteWithCorrectPassword() {
            UserAuthProvider emailProvider = TestDataFactory.emailAuthProvider(user);
            stubActiveUserWith(emailProvider);
            when(passwordEncoder.matches(
                            TestDataFactory.RAW_PASSWORD, TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(true);

            ApiResponse<Void> response =
                    userService.deleteAccount(
                            TestDataFactory.USER_ID, withPassword(TestDataFactory.RAW_PASSWORD));

            assertThat(response.getStatus()).isEqualTo(HttpStatus.OK.value());
            assertThat(response.getMessage()).isEqualTo("Account deleted successfully");
            assertDeleted(List.of(emailProvider));
        }

        @Test
        @DisplayName("rejects a wrong password with 401 and keeps the account")
        void shouldRejectWrongPassword() {
            stubActiveUserWith(TestDataFactory.emailAuthProvider(user));
            when(passwordEncoder.matches("wrong-password", TestDataFactory.HASHED_PASSWORD))
                    .thenReturn(false);

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            withPassword("wrong-password")))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Password is incorrect")
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
            assertNotDeleted();
        }

        @Test
        @DisplayName("rejects a password with 400 for an account that has none")
        void shouldRejectPasswordForOAuthOnlyAccount() {
            stubActiveUserWith(oauthProvider(AuthProvider.GOOGLE, GOOGLE_SUB));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            withPassword(TestDataFactory.RAW_PASSWORD)))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            assertNotDeleted();
        }

        @Test
        @DisplayName("deletes with a fresh Google token for the linked Google account")
        void shouldDeleteWithLinkedGoogleToken() {
            UserAuthProvider google = oauthProvider(AuthProvider.GOOGLE, GOOGLE_SUB);
            stubActiveUserWith(google);
            when(googleIdTokenVerifier.verify("google-token"))
                    .thenReturn(
                            new OAuthIdentity(
                                    AuthProvider.GOOGLE, GOOGLE_SUB, TestDataFactory.EMAIL, null));

            userService.deleteAccount(
                    TestDataFactory.USER_ID,
                    DeleteAccountRequest.builder().googleIdToken("google-token").build());

            assertDeleted(List.of(google));
            verifyNoInteractions(appleTokenRevoker);
        }

        @Test
        @DisplayName("rejects a valid Google token for a different Google account")
        void shouldRejectGoogleTokenForOtherAccount() {
            stubActiveUserWith(oauthProvider(AuthProvider.GOOGLE, GOOGLE_SUB));
            when(googleIdTokenVerifier.verify("google-token"))
                    .thenReturn(
                            new OAuthIdentity(
                                    AuthProvider.GOOGLE, "someone-else", "x@gmail.com", null));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            DeleteAccountRequest.builder()
                                                    .googleIdToken("google-token")
                                                    .build()))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
            assertNotDeleted();
        }

        @Test
        @DisplayName("rejects a Google token when the account has no Google sign-in")
        void shouldRejectGoogleTokenWithoutGoogleProvider() {
            stubActiveUserWith(TestDataFactory.emailAuthProvider(user));
            when(googleIdTokenVerifier.verify("google-token"))
                    .thenReturn(
                            new OAuthIdentity(
                                    AuthProvider.GOOGLE, GOOGLE_SUB, TestDataFactory.EMAIL, null));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            DeleteAccountRequest.builder()
                                                    .googleIdToken("google-token")
                                                    .build()))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
            assertNotDeleted();
        }

        private static final String APPLE_CLIENT_ID = "com.lazybuff.fuel";

        private DeleteAccountRequest withApple(String identityToken) {
            return DeleteAccountRequest.builder()
                    .appleIdentityToken(identityToken)
                    .appleAuthorizationCode("apple-code")
                    .build();
        }

        private void stubAppleToken(String identityToken, String subject) {
            when(appleIdTokenVerifier.verifyWithClientId(identityToken))
                    .thenReturn(
                            new VerifiedAppleToken(
                                    new OAuthIdentity(AuthProvider.APPLE, subject, null, null),
                                    APPLE_CLIENT_ID));
        }

        @Test
        @DisplayName("deletes with a fresh Apple token and revokes the Apple tokens")
        void shouldDeleteWithLinkedAppleTokenAndRevoke() {
            UserAuthProvider apple = oauthProvider(AuthProvider.APPLE, APPLE_SUB);
            stubActiveUserWith(apple);
            stubAppleToken("apple-token", APPLE_SUB);

            userService.deleteAccount(TestDataFactory.USER_ID, withApple("apple-token"));

            assertDeleted(List.of(apple));
            // Revoked with the client ID the identity token was issued to.
            verify(appleTokenRevoker).revoke("apple-code", APPLE_CLIENT_ID);
        }

        @Test
        @DisplayName(
                "requires Apple confirmation for an account with Apple linked, even with a password")
        void shouldRequireAppleWhenAppleLinked() {
            stubActiveUserWith(
                    TestDataFactory.emailAuthProvider(user),
                    oauthProvider(AuthProvider.APPLE, APPLE_SUB));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            withPassword(TestDataFactory.RAW_PASSWORD)))
                    .isInstanceOf(FuelException.class)
                    .hasMessage(
                            "This account uses Sign in with Apple. Confirm with Apple to delete it.")
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            verifyNoInteractions(passwordEncoder, appleTokenRevoker);
            assertNotDeleted();
        }

        @Test
        @DisplayName("requires Apple confirmation even when Google is linked too")
        void shouldRequireAppleOverGoogle() {
            stubActiveUserWith(
                    oauthProvider(AuthProvider.GOOGLE, GOOGLE_SUB),
                    oauthProvider(AuthProvider.APPLE, APPLE_SUB));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            DeleteAccountRequest.builder()
                                                    .googleIdToken("google-token")
                                                    .build()))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            verifyNoInteractions(googleIdTokenVerifier, appleTokenRevoker);
            assertNotDeleted();
        }

        @Test
        @DisplayName("rejects an Apple token for a different Apple ID without revoking anything")
        void shouldRejectAppleTokenForOtherAccount() {
            stubActiveUserWith(oauthProvider(AuthProvider.APPLE, APPLE_SUB));
            stubAppleToken("apple-token", "someone-else");

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID, withApple("apple-token")))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
            verifyNoInteractions(appleTokenRevoker);
            assertNotDeleted();
        }

        @Test
        @DisplayName("propagates an invalid provider token without deleting")
        void shouldPropagateInvalidToken() {
            stubActiveUserWith(oauthProvider(AuthProvider.APPLE, APPLE_SUB));
            when(appleIdTokenVerifier.verifyWithClientId("bad-token"))
                    .thenThrow(
                            new FuelException(
                                    HttpStatus.UNAUTHORIZED, "Invalid Apple identity token"));

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID, withApple("bad-token")))
                    .isInstanceOf(FuelException.class)
                    .hasMessage("Invalid Apple identity token");
            verifyNoInteractions(appleTokenRevoker);
            assertNotDeleted();
        }

        @Test
        @DisplayName("returns 404 when the account is already deleted")
        void shouldReturnNotFoundWhenAlreadyDeleted() {
            when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            withPassword(TestDataFactory.RAW_PASSWORD)))
                    .isInstanceOf(FuelException.class)
                    .extracting(e -> ((FuelException) e).getHttpStatus())
                    .isEqualTo(HttpStatus.NOT_FOUND);
            verifyNoInteractions(rateLimiterService, passwordEncoder, refreshTokenService);
        }

        @Test
        @DisplayName("limits attempts per user so the endpoint can't be used to guess the password")
        void shouldLimitAttempts() {
            when(userRepository.findByIdAndDeletedAtIsNull(TestDataFactory.USER_ID))
                    .thenReturn(Optional.of(user));
            doThrow(new RateLimitExceededException("Too many", Duration.ofMinutes(5)))
                    .when(rateLimiterService)
                    .enforce(
                            eq("rate_limit:delete-account:" + TestDataFactory.USER_ID),
                            eq(5),
                            eq(Duration.ofMinutes(15)),
                            anyString());

            assertThatThrownBy(
                            () ->
                                    userService.deleteAccount(
                                            TestDataFactory.USER_ID,
                                            withPassword(TestDataFactory.RAW_PASSWORD)))
                    .isInstanceOf(RateLimitExceededException.class);
            verifyNoInteractions(passwordEncoder);
            assertNotDeleted();
        }
    }
}
