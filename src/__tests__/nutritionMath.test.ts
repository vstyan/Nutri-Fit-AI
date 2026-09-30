import { describe, it, expect } from 'vitest';
import { MealRecord, FoodItem, HistoryDayRecord } from '../types';

describe('Nutrition Math & Aggregations', () => {
  describe('Net Carbs Calculation', () => {
    // Formula: Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10)
    const computeNetCarbs = (carbs: number, fiber: number): number => {
      return Math.max(0, Math.round((carbs - fiber) * 10) / 10);
    };

    it('correctly subtracts fiber from total carbohydrates with 1 decimal precision', () => {
      expect(computeNetCarbs(25.5, 4.2)).toBe(21.3);
      expect(computeNetCarbs(50, 10)).toBe(40);
      expect(computeNetCarbs(15.25, 3.12)).toBe(12.1);
    });

    it('clamps negative results to 0 when fiber exceeds carbs or measurement anomalies occur', () => {
      expect(computeNetCarbs(5, 8)).toBe(0);
      expect(computeNetCarbs(0, 5)).toBe(0);
    });

    it('handles zero fiber or zero carbs', () => {
      expect(computeNetCarbs(30, 0)).toBe(30);
      expect(computeNetCarbs(0, 0)).toBe(0);
    });
  });

  describe('Dietary Cholesterol Aggregation', () => {
    it('aggregates itemized dietary cholesterol in meal review accurately', () => {
      const items: Partial<FoodItem>[] = [
        { name: 'Eggs (2 large)', cholesterol: 372 },
        { name: 'Avocado', cholesterol: 0 },
        { name: 'Butter (1 tbsp)', cholesterol: 31 },
        { name: 'Toast', cholesterol: undefined }
      ];

      const totalCholesterol = Math.round(
        items.reduce((sum, item) => sum + (Number(item.cholesterol) || 0), 0)
      );

      expect(totalCholesterol).toBe(403);
    });

    it('aggregates daily dietary cholesterol across multiple meals', () => {
      const dailyMeals: Partial<MealRecord>[] = [
        { totalCholesterol: 403, mealType: 'breakfast' },
        { totalCholesterol: 75, mealType: 'lunch' },
        { totalCholesterol: 120, mealType: 'dinner' },
        { totalCholesterol: undefined, mealType: 'snack' }
      ];

      const dailyTotal = Math.round(
        dailyMeals.reduce((sum, m) => sum + (m.totalCholesterol ?? 0), 0)
      );

      expect(dailyTotal).toBe(598);
    });

    it('computes 7-day rolling total, average, and comparison against weekly limit', () => {
      const history7d: Partial<HistoryDayRecord>[] = [
        { cholesterolIntake: 250 },
        { cholesterolIntake: 320 },
        { cholesterolIntake: 180 },
        { cholesterolIntake: 290 },
        { cholesterolIntake: 210 },
        { cholesterolIntake: 340 },
        { cholesterolIntake: 190 }
      ];

      const totalCholesterol7d = history7d.reduce((sum, d) => sum + (d.cholesterolIntake || 0), 0);
      const avgCholesterol = Math.round(totalCholesterol7d / history7d.length);
      const dailyTarget = 300; // standard AHA recommendation (300 mg/day)
      const weeklyLimit = dailyTarget * 7; // 2100 mg
      const isUnderLimit = totalCholesterol7d <= weeklyLimit;

      expect(totalCholesterol7d).toBe(1780);
      expect(avgCholesterol).toBe(254);
      expect(weeklyLimit).toBe(2100);
      expect(isUnderLimit).toBe(true);
      expect(weeklyLimit - totalCholesterol7d).toBe(320); // 320 mg margin remaining
    });

    it('accurately identifies when 7-day intake exceeds weekly limit', () => {
      const historyHigh: Partial<HistoryDayRecord>[] = [
        { cholesterolIntake: 450 },
        { cholesterolIntake: 400 },
        { cholesterolIntake: 380 },
        { cholesterolIntake: 500 },
        { cholesterolIntake: 350 },
        { cholesterolIntake: 420 },
        { cholesterolIntake: 300 }
      ];

      const totalCholesterol7d = historyHigh.reduce((sum, d) => sum + (d.cholesterolIntake || 0), 0);
      const weeklyLimit = 300 * 7;
      const overAmount = totalCholesterol7d - weeklyLimit;

      expect(totalCholesterol7d).toBe(2800);
      expect(totalCholesterol7d > weeklyLimit).toBe(true);
      expect(overAmount).toBe(700);
    });
  });

  describe('Macronutrient Arithmetic & Caloric Validation', () => {
    it('calculates theoretical Atwater 4-4-9 caloric sum from macros', () => {
      const proteinGrams = 150; // 150 * 4 = 600 kcal
      const carbsGrams = 200;   // 200 * 4 = 800 kcal
      const fatGrams = 70;      // 70 * 9  = 630 kcal

      const atwaterCalories = (proteinGrams * 4) + (carbsGrams * 4) + (fatGrams * 9);
      expect(atwaterCalories).toBe(2030);
    });

    it('validates fat subtype summation (Saturated + Unsaturated + Trans <= Total Fat)', () => {
      const saturatedFat = 12;
      const unsaturatedFat = 45;
      const transFat = 0.5;
      const totalFat = 60;

      const subFatSum = saturatedFat + unsaturatedFat + transFat;
      expect(subFatSum).toBeLessThanOrEqual(totalFat);
    });
  });

  describe('Metabolic Trajectory & Weight Shift Projections', () => {
    // 3500 kcal = 1 lb fat
    // 7700 kcal = 1 kg fat
    const calculateWeightShiftLbs = (netWeeklyCalories: number): number => {
      return Math.round((netWeeklyCalories / 3500) * 10) / 10;
    };

    const calculateWeightShiftKg = (netWeeklyCalories: number): number => {
      return Math.round((netWeeklyCalories / 7700) * 100) / 100;
    };

    it('projects accurate 1.0 lb/week weight loss for standard 500 kcal daily deficit', () => {
      const dailyDeficit = -500;
      const weeklyNet = dailyDeficit * 7; // -3500 kcal
      expect(calculateWeightShiftLbs(weeklyNet)).toBe(-1.0);
    });

    it('projects accurate 0.5 lb/week surplus for 250 kcal daily surplus', () => {
      const dailySurplus = 250;
      const weeklyNet = dailySurplus * 7; // +1750 kcal
      expect(calculateWeightShiftLbs(weeklyNet)).toBe(0.5);
    });

    it('projects accurate metric fat loss in kg', () => {
      const weeklyDeficit = -3850; // -550 kcal/day * 7
      expect(calculateWeightShiftKg(weeklyDeficit)).toBe(-0.5);
    });
  });
});
