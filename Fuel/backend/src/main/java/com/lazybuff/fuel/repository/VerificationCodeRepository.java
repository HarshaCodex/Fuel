package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.util.VerifyType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface VerificationCodeRepository extends JpaRepository<VerificationCode, UUID> {

    Optional<VerificationCode> findByUser_IdAndTypeAndCodeHashAndUsedAtIsNull(
            UUID userId, VerifyType type, String codeHash);

    @Modifying
    @Query(
            """
            UPDATE VerificationCode v
            SET v.usedAt = CURRENT_TIMESTAMP
            WHERE v.user = :user AND v.type = :verifyType
            """)
    void invalidateAllVerificationCodes(User user, VerifyType verifyType);

    /**
     * Deletes codes that can no longer be used: used or invalidated, or expired before {@code now}
     * (#90).
     *
     * @return the number of codes deleted
     */
    @Modifying
    @Query("DELETE FROM VerificationCode v WHERE v.usedAt IS NOT NULL OR v.expires_at < :now")
    int deleteUsedOrExpired(@Param("now") Instant now);
}
