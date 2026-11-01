package com.lazybuff.fuel.dto;

import com.lazybuff.fuel.util.AuthProvider;
import java.time.OffsetDateTime;

/**
 * The authenticated user's profile, as returned by {@code GET /api/user/profile}.
 *
 * @param authProvider the provider the user originally registered with, even if others were linked
 *     later
 */
public record UserProfile(
        String userId,
        String email,
        String name,
        String profilePhotoUrl,
        boolean emailVerified,
        AuthProvider authProvider,
        String timezone,
        OffsetDateTime createdAt) {}
