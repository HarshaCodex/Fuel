package com.lazybuff.fuel.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One diary day's summed nutrients and entry count, as returned by the grouped history query. */
public record DailyTotals(
        LocalDate logDate,
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbs,
        BigDecimal fat,
        BigDecimal fiber,
        Long entryCount) {}
