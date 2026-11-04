package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.BodyStats;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BodyStatsRepository extends JpaRepository<BodyStats, UUID> {

    Optional<BodyStats> findByUser_Id(UUID userId);
}
