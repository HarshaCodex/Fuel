package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.util.AuthProvider;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, UUID> {

    UserAuthProvider findByUser_IdAndProvider(UUID userId, AuthProvider provider);

    Optional<UserAuthProvider> findByProviderAndProviderIdAndUser_DeletedAtIsNull(
            AuthProvider provider, String providerId);

    Optional<UserAuthProvider> findFirstByUser_IdOrderByCreatedAtAsc(UUID userId);
}
