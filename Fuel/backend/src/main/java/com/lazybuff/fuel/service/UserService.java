package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.AccountDeletionConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.DeleteAccountRequest;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.security.AppleIdTokenVerifier;
import com.lazybuff.fuel.security.AppleTokenRevoker;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import com.lazybuff.fuel.security.OAuthIdentity;
import com.lazybuff.fuel.security.VerifiedAppleToken;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and manages the authenticated user's own account data. */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    private final RefreshTokenService refreshTokenService;

    private final RateLimiterService rateLimiterService;

    private final PasswordEncoder passwordEncoder;

    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    private final AppleIdTokenVerifier appleIdTokenVerifier;

    private final AccountDeletionConfig accountDeletionConfig;

    private final AppleTokenRevoker appleTokenRevoker;

    /**
     * @throws FuelException 404 if the user no longer exists (e.g. deleted while the access token
     *     is still valid)
     */
    @Transactional(readOnly = true)
    public ApiResponse<UserProfile> getProfile(UUID userId) {

        User user = findActiveUser(userId);

        UserAuthProvider originalProvider =
                userAuthProviderRepository
                        .findFirstByUser_IdOrderByCreatedAtAsc(userId)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "User " + userId + " has no auth provider"));

        UserProfile profile =
                new UserProfile(
                        user.getId().toString(),
                        user.getEmail(),
                        user.getName(),
                        user.getProfilePhotoUrl(),
                        user.isEmailVerified(),
                        originalProvider.getProvider(),
                        user.getTimezone(),
                        user.getCreatedAt());

        return ApiResponse.<UserProfile>builder()
                .status(HttpStatus.OK.value())
                .message("Success")
                .data(profile)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Deletes the caller's account after they prove they own it (password, or a fresh Google /
     * Apple token for a linked account).
     *
     * <p>The account is soft-deleted: sign-in methods and sessions are removed at once and the
     * email is free for a new sign-up, while the data is kept for the grace period and then purged
     * by {@link com.lazybuff.fuel.scheduler.DeletedAccountPurge}. Access tokens already issued stay
     * valid until they expire (at most 15 minutes), but every user lookup now returns 404.
     *
     * @throws FuelException 404 if the account is already deleted, 400 if the chosen confirmation
     *     method isn't available for this account, 401 if the confirmation is wrong
     * @throws com.lazybuff.fuel.exception.RateLimitExceededException after too many attempts
     */
    @Transactional
    @NoLogging
    public ApiResponse<Void> deleteAccount(UUID userId, DeleteAccountRequest request) {

        User user = findActiveUser(userId);

        rateLimiterService.enforce(
                "rate_limit:delete-account:" + userId,
                accountDeletionConfig.getMaxAttempts(),
                accountDeletionConfig.getAttemptWindow(),
                "Too many attempts. Please try again later.");

        List<UserAuthProvider> providers = userAuthProviderRepository.findByUser_Id(userId);

        Optional<VerifiedAppleToken> appleToken = confirmOwnership(request, providers);

        userAuthProviderRepository.deleteAll(providers);
        refreshTokenService.revokeAll(userId);
        user.setDeletedAt(OffsetDateTime.now());
        userRepository.save(user);

        log.info("User {} deleted their account", userId);

        // Best-effort and never throws, so a failure at Apple can't block the deletion.
        appleToken.ifPresent(
                token ->
                        appleTokenRevoker.revoke(
                                request.getAppleAuthorizationCode(), token.clientId()));

        return ApiResponse.<Void>builder()
                .status(HttpStatus.OK.value())
                .message("Account deleted successfully")
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Checks the request proves ownership of the account.
     *
     * @return the verified Apple token when the user confirmed with Apple, so its tokens can be
     *     revoked
     */
    private Optional<VerifiedAppleToken> confirmOwnership(
            DeleteAccountRequest request, List<UserAuthProvider> providers) {

        boolean confirmedWithApple = isPresent(request.getAppleIdentityToken());

        // Apple requires revoking its tokens on deletion, which needs a fresh Apple authorization
        // code, so any account with Apple linked has to confirm through Apple.
        if (findProvider(providers, AuthProvider.APPLE).isPresent() && !confirmedWithApple) {
            throw new FuelException(
                    HttpStatus.BAD_REQUEST,
                    "This account uses Sign in with Apple. Confirm with Apple to delete it.");
        }

        if (isPresent(request.getPassword())) {
            UserAuthProvider emailProvider =
                    findProvider(providers, AuthProvider.EMAIL)
                            .orElseThrow(
                                    () ->
                                            new FuelException(
                                                    HttpStatus.BAD_REQUEST,
                                                    "This account has no password. Confirm with"
                                                            + " Google or Apple instead."));
            if (!passwordEncoder.matches(request.getPassword(), emailProvider.getPasswordHash())) {
                throw new FuelException(HttpStatus.UNAUTHORIZED, "Password is incorrect");
            }
            return Optional.empty();
        }

        VerifiedAppleToken appleToken =
                confirmedWithApple
                        ? appleIdTokenVerifier.verifyWithClientId(request.getAppleIdentityToken())
                        : null;
        OAuthIdentity identity =
                appleToken != null
                        ? appleToken.identity()
                        : googleIdTokenVerifier.verify(request.getGoogleIdToken());

        boolean linked =
                findProvider(providers, identity.provider())
                        .map(provider -> provider.getProviderId().equals(identity.subject()))
                        .orElse(false);

        if (!linked) {
            throw new FuelException(
                    HttpStatus.UNAUTHORIZED,
                    "That "
                            + (identity.provider() == AuthProvider.GOOGLE ? "Google" : "Apple")
                            + " account isn't linked to this account.");
        }
        return Optional.ofNullable(appleToken);
    }

    private User findActiveUser(UUID userId) {
        return userRepository
                .findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(
                        () -> {
                            log.warn("Request for missing user {}", userId);
                            return new FuelException(HttpStatus.NOT_FOUND, "User not found");
                        });
    }

    private static Optional<UserAuthProvider> findProvider(
            List<UserAuthProvider> providers, AuthProvider type) {
        return providers.stream().filter(provider -> provider.getProvider() == type).findFirst();
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
