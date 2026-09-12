package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.util.VerifyType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
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
}
