package com.lazybuff.fuel.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "user_goals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class UserGoals {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "calorie_goal", nullable = false)
    @Builder.Default
    private int calorieGoal = 2000;

    @Column(name = "protein_goal", nullable = false)
    @Builder.Default
    private double proteinGoal = 50.0;

    @Column(name = "carb_goal", nullable = false)
    @Builder.Default
    private double carbGoal = 250.0;

    @Column(name = "fat_goal", nullable = false)
    @Builder.Default
    private double fatGoal = 65.0;

    @Column(name = "is_auto_calculated", nullable = false)
    private boolean isAutoCalculated;

    @Column(name = "goal_type", length = 10)
    @Builder.Default
    private String goalType = "MAINTAIN";

    @Column(name = "calorie_adjustment")
    @Builder.Default
    private int calorieAdjustment = 0;

    @Column(name = "created_at", updatable = false, nullable = false)
    @CreationTimestamp
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
