package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * Deletes the token in one statement and reports whether this call removed it. Unlike a derived
     * delete (load, then remove), concurrent calls don't fail: Postgres makes the second one wait
     * for the first and then delete nothing, so exactly one caller gets 1 (#89).
     *
     * @return 1 if this call deleted the token, 0 if it was already gone
     */
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.tokenHash = :tokenHash")
    int deleteByTokenHashReturningCount(@Param("tokenHash") String tokenHash);

    void deleteByUser_Id(UUID userId);

    void deleteByExpiresAtBefore(Instant cutoff);

    void deleteByTokenHashAndUser_Id(String tokenHash, UUID userId);
}
