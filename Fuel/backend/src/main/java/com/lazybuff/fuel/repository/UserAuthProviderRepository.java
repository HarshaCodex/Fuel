package com.lazybuff.fuel.repository;

import com.lazybuff.fuel.entity.UserAuthProvider;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, UUID> {}
