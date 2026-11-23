package com.lazybuff.fuel.service;

import com.lazybuff.fuel.util.ActivityLevel;
import com.lazybuff.fuel.util.GoalType;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure Mifflin-St Jeor calorie and 40/40/20 macro calculation. No state, no I/O. */
public final class GoalsCalculator {

    public static final int MIN_CALORIES = 800;
    public static final int MAX_CALORIES = 10000;
    public static final int DEFAULT_DEFICIT = 500;
    public static final String FORMULA = "MIFFLIN_ST_JEOR";
    public static final String MACRO_SPLIT = "40/40/20";

    static final int PROTEIN_PERCENT = 40;
    static final int CARB_PERCENT = 40;
    static final int FAT_PERCENT = 20;
    static final int KCAL_PER_GRAM_PROTEIN = 4;
    static final int KCAL_PER_GRAM_CARB = 4;
    static final int KCAL_PER_GRAM_FAT = 9;

    private static final double WEIGHT_COEFFICIENT = 10;
    private static final double HEIGHT_COEFFICIENT = 6.25;
    private static final double AGE_COEFFICIENT = 5;
    private static final double MALE_OFFSET = 5;
    private static final double FEMALE_OFFSET = -161;
    private static final int MACRO_SCALE = 1;
    private static final int PERCENT_DIVISOR = 100;

    /** Calculated figures. Macros are grams rounded to one decimal. */
    public record GoalsCalculation(
            int tdee, int deficit, int calorieGoal, double protein, double carb, double fat) {}

    private GoalsCalculator() {}

    /**
     * @param male true for the male BMR offset, false for the female one
     * @param deficit kcal to subtract (LOSE) or add (GAIN); ignored for MAINTAIN
     */
    public static GoalsCalculation calculate(
            boolean male,
            int age,
            double heightCm,
            double weightKg,
            ActivityLevel activityLevel,
            GoalType goal,
            int deficit) {

        double bmr =
                WEIGHT_COEFFICIENT * weightKg
                        + HEIGHT_COEFFICIENT * heightCm
                        - AGE_COEFFICIENT * age
                        + (male ? MALE_OFFSET : FEMALE_OFFSET);
        int tdee = (int) Math.round(bmr * activityLevel.getFactor());

        int appliedDeficit = goal == GoalType.MAINTAIN ? 0 : deficit;
        int target =
                switch (goal) {
                    case LOSE -> tdee - deficit;
                    case GAIN -> tdee + deficit;
                    case MAINTAIN -> tdee;
                };
        int calories = Math.max(MIN_CALORIES, Math.min(MAX_CALORIES, target));

        return new GoalsCalculation(
                tdee,
                appliedDeficit,
                calories,
                grams(calories, PROTEIN_PERCENT, KCAL_PER_GRAM_PROTEIN),
                grams(calories, CARB_PERCENT, KCAL_PER_GRAM_CARB),
                grams(calories, FAT_PERCENT, KCAL_PER_GRAM_FAT));
    }

    private static double grams(int calories, int percent, int kcalPerGram) {
        return BigDecimal.valueOf((long) calories * percent)
                .divide(
                        BigDecimal.valueOf((long) PERCENT_DIVISOR * kcalPerGram),
                        MACRO_SCALE,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }
}
