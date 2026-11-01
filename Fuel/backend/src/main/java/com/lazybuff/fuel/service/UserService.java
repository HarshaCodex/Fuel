package com.lazybuff.fuel.service;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserProfile;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and manages the authenticated user's own account data. */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    /**
     * @throws FuelException 404 if the user no longer exists (e.g. deleted while the access token
     *     is still valid)
     */
    @Transactional(readOnly = true)
    public ApiResponse<UserProfile> getProfile(UUID userId) {

        User user =
                userRepository
                        .findByIdAndDeletedAtIsNull(userId)
                        .orElseThrow(
                                () -> {
                                    log.warn("Profile requested for missing user {}", userId);
                                    return new FuelException(
                                            HttpStatus.NOT_FOUND, "User not found");
                                });

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
}
