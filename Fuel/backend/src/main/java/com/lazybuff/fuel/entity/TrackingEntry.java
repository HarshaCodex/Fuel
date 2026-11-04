package com.lazybuff.fuel.entity;

import com.lazybuff.fuel.converter.LowercaseConverter;
import com.lazybuff.fuel.util.FoodSource;
import com.lazybuff.fuel.util.ServingUnit;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import java.math.BigDecimal;
import java.time.LocalDate;
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
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * One logged food. Name, source, serving and nutrient values are snapshots taken at log time, so
 * later edits to the food do not rewrite history.
 */
@Entity
@Table(name = "tracking_entries")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "user")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
public class TrackingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Plain column, not a relation: the food may be soft-deleted later and must not hide here. */
    @Column(name = "food_id", nullable = false)
    private UUID foodId;

    @Column(name = "food_name", nullable = false)
    private String foodName;

    @Column(name = "food_source", nullable = false)
    @Enumerated(EnumType.STRING)
    private FoodSource foodSource;

    @Column(name = "serving_size", nullable = false)
    private BigDecimal servingSize;

    @Column(name = "serving_unit", nullable = false)
    @Convert(converter = LowercaseConverter.class)
    private ServingUnit servingUnit;

    @Column(name = "quantity", nullable = false)
    private BigDecimal quantity;

    @Column(name = "meal_label")
    private String mealLabel;

    @Column(name = "logged_at", nullable = false)
    private OffsetDateTime loggedAt;

    /** The calendar day of {@code loggedAt} in the user's timezone. */
    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(name = "calories", nullable = false)
    private BigDecimal calories;

    @Column(name = "protein", nullable = false)
    private BigDecimal protein;

    @Column(name = "carbs", nullable = false)
    private BigDecimal carbs;

    @Column(name = "fat", nullable = false)
    private BigDecimal fat;

    @Column(name = "fiber", nullable = false)
    @Builder.Default
    private BigDecimal fiber = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
