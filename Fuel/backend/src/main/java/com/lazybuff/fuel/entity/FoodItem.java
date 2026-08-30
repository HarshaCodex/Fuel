package com.lazybuff.fuel.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
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

import com.lazybuff.fuel.converter.LowercaseConverter;

@Entity
@Table(name = "food_items")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class FoodItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = true)
    private User user;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "brand")
    private String brand;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "barcode")
    private String barcode;

    @Column(name = "serving_size", nullable = false)
    private String servingSize;

    @Column(name = "serving_unit", nullable = false)
    @Convert(converter = LowercaseConverter.class)
    private String servingUnit;

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

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    @CreationTimestamp
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
