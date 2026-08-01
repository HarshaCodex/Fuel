package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.VerificationCode;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VerificationCodeRepository extends JpaRepository<VerificationCode, UUID> {}
