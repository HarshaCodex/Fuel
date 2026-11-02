package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.User;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    User findByEmailAndDeletedAtIsNull(String email);

    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    /**
     * Permanently deletes accounts soft-deleted before {@code cutoff}; their goals, auth providers,
     * refresh tokens and verification codes cascade. Native because {@code User}'s
     * {@code @SQLRestriction} hides deleted rows from JPQL.
     *
     * @return the number of accounts purged
     */
    @Modifying
    @Query(
            value = "DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff",
            nativeQuery = true)
    int purgeDeletedBefore(@Param("cutoff") Instant cutoff);

    /**
     * Permanently deletes active accounts whose email is still unverified and that were created
     * before {@code cutoff} (#89). Only email/password sign-ups can be unverified; Google and Apple
     * accounts are verified when created or linked. Related rows cascade as in {@link
     * #purgeDeletedBefore}.
     *
     * @return the number of accounts purged
     */
    @Modifying
    @Query(
            value =
                    """
                    DELETE FROM users
                    WHERE email_verified = FALSE AND deleted_at IS NULL AND created_at < :cutoff
                    """,
            nativeQuery = true)
    int purgeUnverifiedCreatedBefore(@Param("cutoff") Instant cutoff);
}
