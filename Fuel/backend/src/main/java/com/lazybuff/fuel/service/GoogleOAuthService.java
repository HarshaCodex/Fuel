package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
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
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import com.lazybuff.fuel.security.GoogleIdentity;
import com.lazybuff.fuel.util.AuthProvider;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Signs users in (or up) with a Google ID token obtained by the client app. */
@Service
@Slf4j
@RequiredArgsConstructor
public class GoogleOAuthService {

    private static final int MAX_NAME_LENGTH = 100;

    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    private final UserGoalsRepository userGoalsRepository;

    private final RefreshTokenService refreshTokenService;

    private final JwtService jwtService;

    private final JwtConfig jwtConfig;

    /**
     * Logs in the user linked to the Google account, linking or creating one by email if needed.
     */
    @Transactional
    @NoLogging
    public ApiResponse<UserData> authenticate(
            OAuthGoogleRequest oAuthGoogleRequest, ClientInfo clientInfo) throws Exception {

        GoogleIdentity identity = googleIdTokenVerifier.verify(oAuthGoogleRequest.getIdToken());

        User linkedUser =
                userAuthProviderRepository
                        .findByProviderAndProviderIdAndUser_DeletedAtIsNull(
                                AuthProvider.GOOGLE, identity.subject())
                        .map(UserAuthProvider::getUser)
                        .orElse(null);

        if (linkedUser != null) {
            return buildResponse(linkedUser, false, clientInfo);
        }

        User existingUser = userRepository.findByEmailAndDeletedAtIsNull(identity.email());

        if (existingUser != null) {
            linkGoogleAccount(existingUser, identity);
            return buildResponse(existingUser, false, clientInfo);
        }

        User newUser = createUser(identity);
        log.info("Created user {} via Google sign-in", newUser.getId());
        return buildResponse(newUser, true, clientInfo);
    }

    private void linkGoogleAccount(User user, GoogleIdentity identity) {

        if (userAuthProviderRepository.findByUser_IdAndProvider(user.getId(), AuthProvider.GOOGLE)
                != null) {
            throw new FuelException(
                    HttpStatus.CONFLICT,
                    "This account is already linked to a different Google account.");
        }

        if (!user.isEmailVerified()) {
            // Anyone can register an unverified email/password account for an address they don't
            // own. Google has now proven who owns the inbox, so drop that unproven password and its
            // sessions rather than letting a squatter keep access to the linked account.
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

        saveGoogleProvider(user, identity);
        log.info("Linked Google account to existing user {}", user.getId());
    }

    private User createUser(GoogleIdentity identity) {

        User user =
                userRepository.save(
                        User.builder()
                                .email(identity.email())
                                .name(resolveName(identity))
                                .emailVerified(true)
                                .build());

        saveGoogleProvider(user, identity);
        userGoalsRepository.save(UserGoals.builder().user(user).build());
        return user;
    }

    private void saveGoogleProvider(User user, GoogleIdentity identity) {
        userAuthProviderRepository.save(
                UserAuthProvider.builder()
                        .user(user)
                        .provider(AuthProvider.GOOGLE)
                        .providerId(identity.subject())
                        .build());
    }

    private static String resolveName(GoogleIdentity identity) {
        String name = identity.name();
        if (name == null || name.isBlank()) {
            name = identity.email().substring(0, identity.email().indexOf('@'));
        }
        name = name.strip();
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    private ApiResponse<UserData> buildResponse(User user, boolean isNewUser, ClientInfo clientInfo)
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
                .message("Google authentication successful")
                .data(userData)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
