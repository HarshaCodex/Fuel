package com.lazybuff.fuel.entity;

import com.lazybuff.fuel.util.VerifyType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "verification_codes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class VerificationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id", nullable = false)
    private UUID user_id;

    @Column(name = "code_hash", nullable = false, length = 255)
    private String code_hash;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private VerifyType type;

    @Column(name = "expires_at", nullable = false)
    private Instant expires_at;

    @Column(name = "used_at")
    private Instant used_at;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime created_at;
}
