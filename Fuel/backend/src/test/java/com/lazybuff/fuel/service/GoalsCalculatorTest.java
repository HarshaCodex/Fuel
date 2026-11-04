package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.service.GoalsCalculator.GoalsCalculation;
import com.lazybuff.fuel.util.ActivityLevel;
import com.lazybuff.fuel.util.GoalType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("GoalsCalculator")
class GoalsCalculatorTest {

    private static GoalsCalculation male(GoalType goal, int deficit) {
        return GoalsCalculator.calculate(true, 30, 180, 80, ActivityLevel.MODERATE, goal, deficit);
    }

    @Test
    @DisplayName("uses the male Mifflin-St Jeor offset")
    void shouldComputeMaleTdee() {
        assertThat(male(GoalType.MAINTAIN, 500).tdee()).isEqualTo(2759);
    }

    @Test
    @DisplayName("uses the female Mifflin-St Jeor offset")
    void shouldComputeFemaleTdee() {
        GoalsCalculation result =
                GoalsCalculator.calculate(
                        false, 25, 165, 60, ActivityLevel.SEDENTARY, GoalType.MAINTAIN, 500);

        assertThat(result.tdee()).isEqualTo(1614);
    }

    @Test
    @DisplayName("LOSE subtracts the deficit and splits macros 40/40/20")
    void shouldSubtractDeficitForLose() {
        GoalsCalculation result = male(GoalType.LOSE, 500);

        assertThat(result.calorieGoal()).isEqualTo(2259);
        assertThat(result.deficit()).isEqualTo(500);
        assertThat(result.protein()).isEqualTo(225.9);
        assertThat(result.carb()).isEqualTo(225.9);
        assertThat(result.fat()).isEqualTo(50.2);
    }

    @Test
    @DisplayName("GAIN adds the surplus")
    void shouldAddDeficitForGain() {
        assertThat(male(GoalType.GAIN, 300).calorieGoal()).isEqualTo(3059);
    }

    @Test
    @DisplayName("MAINTAIN ignores the deficit and reports 0")
    void shouldIgnoreDeficitForMaintain() {
        GoalsCalculation result = male(GoalType.MAINTAIN, 900);

        assertThat(result.calorieGoal()).isEqualTo(2759);
        assertThat(result.deficit()).isZero();
    }

    @Test
    @DisplayName("macro calories reconcile with the goal within rounding")
    void shouldReconcileMacroCalories() {
        GoalsCalculation result = male(GoalType.LOSE, 250);

        double kcal = result.protein() * 4 + result.carb() * 4 + result.fat() * 9;
        assertThat(kcal).isCloseTo(result.calorieGoal(), org.assertj.core.data.Offset.offset(1.0));
    }

    @Test
    @DisplayName("clamps up to 800 kcal and derives macros from the clamped value")
    void shouldClampToMinimum() {
        GoalsCalculation result =
                GoalsCalculator.calculate(
                        false, 120, 50, 20, ActivityLevel.SEDENTARY, GoalType.LOSE, 1000);

        assertThat(result.calorieGoal()).isEqualTo(800);
        assertThat(result.protein()).isEqualTo(80.0);
        assertThat(result.fat()).isEqualTo(17.8);
    }

    @Test
    @DisplayName("clamps down to 10000 kcal with grams within DECIMAL(5,1)")
    void shouldClampToMaximum() {
        GoalsCalculation result =
                GoalsCalculator.calculate(
                        true, 13, 300, 300, ActivityLevel.VERY_ACTIVE, GoalType.GAIN, 1000);

        assertThat(result.calorieGoal()).isEqualTo(10000);
        assertThat(result.protein()).isEqualTo(1000.0);
    }
}
