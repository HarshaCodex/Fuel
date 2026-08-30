package com.lazybuff.fuel.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class FoodItemDetail {

    private UUID id;
    private String name;
    private String brand;
    private String source;
    private String sourceId;
    private String barcode;
    private BigDecimal servingSize;
    private String servingUnit;
    private List<ServingSizeData> servingSizeDatas;
    private BigDecimal calories;
    private BigDecimal protein;
    private BigDecimal carbs;
    private BigDecimal fat;
    private BigDecimal fiber;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
