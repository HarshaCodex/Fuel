package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.security.OAuthIdentity;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Signs users in (or up) from an identity an OAuth provider has already verified.
 *
 * <p>Shared by every provider so the account-linking rules in ADR 0001 are enforced in one place.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OAuthAccountService {

    private static final int MAX_NAME_LENGTH = 100;

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    private final UserGoalsRepository userGoalsRepository;

    private final RefreshTokenService refreshTokenService;

    private final JwtService jwtService;

    private final JwtConfig jwtConfig;

    /**
     * Logs in the user linked to the provider account, linking or creating one by email if needed.
     *
     * @throws FuelException 400 if the user isn't linked yet and the identity has no email, 409 if
     *     the email's account is linked to a different account of the same provider
     */
    @Transactional
    @NoLogging
    public ApiResponse<UserData> signIn(OAuthIdentity identity, ClientInfo clientInfo)
            throws Exception {

        User linkedUser =
                userAuthProviderRepository
                        .findByProviderAndProviderIdAndUser_DeletedAtIsNull(
                                identity.provider(), identity.subject())
                        .map(UserAuthProvider::getUser)
                        .orElse(null);

        if (linkedUser != null) {
            return buildResponse(linkedUser, false, identity.provider(), clientInfo);
        }

        if (identity.email() == null) {
            // Without a provider-verified email there's nothing to safely link to or create from.
            // Apple can omit it; an already-linked user is still found by subject above.
            throw new FuelException(
                    HttpStatus.BAD_REQUEST,
                    displayName(identity.provider())
                            + " did not share a verified email address, so no account can be"
                            + " created. Allow email sharing and try again.");
        }

        User existingUser = userRepository.findByEmailAndDeletedAtIsNull(identity.email());

        if (existingUser != null) {
            linkProvider(existingUser, identity);
            return buildResponse(existingUser, false, identity.provider(), clientInfo);
        }

        User newUser = createUser(identity);
        log.info(
                "Created user {} via {} sign-in",
                newUser.getId(),
                displayName(identity.provider()));
        return buildResponse(newUser, true, identity.provider(), clientInfo);
    }

    private void linkProvider(User user, OAuthIdentity identity) {

        if (userAuthProviderRepository.findByUser_IdAndProvider(user.getId(), identity.provider())
                != null) {
            throw new FuelException(
                    HttpStatus.CONFLICT,
                    "This account is already linked to a different "
                            + displayName(identity.provider())
                            + " account.");
        }

        if (!user.isEmailVerified()) {
            // Anyone can register an unverified email/password account for an address they don't
            // own. The provider has now proven who owns the inbox, so drop that unproven password
            // and its sessions rather than letting a squatter keep access to the linked account.
            UserAuthProvider emailProvider =
                    userAuthProviderRepository.findByUser_IdAndProvider(
                            user.getId(), AuthProvider.EMAIL);
            if (emailProvider != null) {
                userAuthProviderRepository.delete(emailProvider);
            }
            refreshTokenService.revokeAll(user.getId());
            user.setEmailVerified(true);
            userRepository.save(user);
        }

        saveProvider(user, identity);
        log.info(
                "Linked {} account to existing user {}",
                displayName(identity.provider()),
                user.getId());
    }

    private User createUser(OAuthIdentity identity) {

        User user =
                userRepository.save(
                        User.builder()
                                .email(identity.email())
                                .name(resolveName(identity))
                                .emailVerified(true)
                                .build());

        saveProvider(user, identity);
        userGoalsRepository.save(UserGoals.builder().user(user).build());
        return user;
    }

    private void saveProvider(User user, OAuthIdentity identity) {
        userAuthProviderRepository.save(
                UserAuthProvider.builder()
                        .user(user)
                        .provider(identity.provider())
                        .providerId(identity.subject())
                        .build());
    }

    private static String resolveName(OAuthIdentity identity) {
        String name = identity.name();
        if (name == null || name.isBlank()) {
            name = identity.email().substring(0, identity.email().indexOf('@'));
        }
        name = name.strip();
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    private static String displayName(AuthProvider provider) {
        return switch (provider) {
            case GOOGLE -> "Google";
            case APPLE -> "Apple";
            case EMAIL -> "Email";
        };
    }

    private ApiResponse<UserData> buildResponse(
            User user, boolean isNewUser, AuthProvider provider, ClientInfo clientInfo)
            throws Exception {

        UserData userData =
                UserData.builder()
                        .userId(user.getId().toString())
                        .email(user.getEmail())
                        .name(user.getName())
                        .emailVerified(user.isEmailVerified())
                        .isNewUser(isNewUser)
                        .accessToken(
                                jwtService.generateToken(user.getId().toString(), user.getEmail()))
                        .refreshToken(
                                refreshTokenService.issueRefreshToken(
                                        user, clientInfo.deviceInfo(), clientInfo.ipAddress()))
                        .accessTokenExpiresIn(jwtConfig.getAccessTokenExpirySeconds())
                        .refreshTokenExpiresIn(jwtConfig.getRefreshTokenExpirySeconds())
                        .build();

        return ApiResponse.<UserData>builder()
                .status(HttpStatus.OK.value())
                .message(displayName(provider) + " authentication successful")
                .data(userData)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
