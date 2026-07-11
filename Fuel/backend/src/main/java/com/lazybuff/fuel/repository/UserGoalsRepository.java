package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.UserGoals;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserGoalsRepository extends JpaRepository<UserGoals, UUID> {}
