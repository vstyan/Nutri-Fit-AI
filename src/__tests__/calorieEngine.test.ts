import { describe, it, expect } from 'vitest';
import { 
  calculateNEAT, 
  calculateTEFBreakdown, 
  calculateMealTEFBreakdown, 
  calculateTDEE 
} from '../utils/calorieEngine';
import { MealRecord, FoodItem } from '../types';

describe('Calorie Engine & TDEE Calculations (Baseline)', () => {
  describe('Non-Exercise Activity Thermogenesis (NEAT)', () => {
    it('calculates sedentary manual NEAT floor as 15% of BMR', () => {
      const bmr = 1800;
      const neat = calculateNEAT({ bmr, source: 'manual', includeResting: true });
      // 1800 * 0.15 = 270
      expect(neat).toBe(270);
    });

    it('returns 0 for NEAT when Google Fit or Health Connect is connected to prevent double-counting', () => {
      const bmr = 1800;
      expect(calculateNEAT({ bmr, source: 'google_fit' })).toBe(0);
      expect(calculateNEAT({ bmr, isGoogleFitConnected: true })).toBe(0);
      expect(calculateNEAT({ bmr, source: 'health_connect' })).toBe(0);
      expect(calculateNEAT({ bmr, isHealthConnectConnected: true })).toBe(0);
    });

    it('returns 0 for NEAT when includeResting is false', () => {
      const bmr = 1800;
      expect(calculateNEAT({ bmr, includeResting: false })).toBe(0);
    });
  });

  describe('Thermic Effect of Food (TEF)', () => {
    it('calculates dynamic TEF: 25% protein, 8% carbs, 2% fat calories', () => {
      // 100g Protein * 4 = 400 kcal -> 25% = 100 kcal
      // 200g Carbs * 4 = 800 kcal -> 8% = 64 kcal
      // 50g Fat * 9 = 450 kcal -> 2% = 9 kcal
      // Total TEF = 100 + 64 + 9 = 173 kcal
      const breakdown = calculateTEFBreakdown(100, 200, 50, 1650);
      expect(breakdown.proteinTef).toBe(100);
      expect(breakdown.carbsTef).toBe(64);
      expect(breakdown.fatTef).toBe(9);
      expect(breakdown.totalTef).toBe(173);
    });

    it('falls back to 10% baseline when macronutrients are zero/missing but calories are provided', () => {
      const breakdown = calculateTEFBreakdown(0, 0, 0, 2000);
      expect(breakdown.proteinTef).toBe(0);
      expect(breakdown.carbsTef).toBe(0);
      expect(breakdown.fatTef).toBe(0);
      expect(breakdown.totalTef).toBe(200); // 10% of 2000
    });

    it('aggregates item-level macros if meal-level macros are missing', () => {
      const sampleItem1: FoodItem = {
        id: 'item-1',
        name: 'Chicken Breast',
        portion: '200g',
        grams: 200,
        calories: 330,
        protein: 62,
        carbs: 0,
        fiber: 0,
        fat: 7
      };
      const sampleItem2: FoodItem = {
        id: 'item-2',
        name: 'Jasmine Rice',
        portion: '150g',
        grams: 150,
        calories: 195,
        protein: 4,
        carbs: 43,
        fiber: 1,
        fat: 1
      };
      const meal: MealRecord = {
        id: 'meal-1',
        timestamp: '2026-09-30T12:00:00.000Z',
        date: '2026-09-30',
        mealType: 'lunch',
        title: 'Chicken and Rice',
        items: [sampleItem1, sampleItem2],
        totalCalories: 525,
        totalProtein: 0, // purposely 0 to test fallback to items
        totalCarbs: 0,
        totalFiber: 0,
        netCarbs: 0,
        totalFat: 0
      };

      const breakdown = calculateMealTEFBreakdown(meal);
      // Items sum: Protein = 66g (264 kcal -> 66), Carbs = 43g (172 kcal -> 13.8), Fat = 8g (72 kcal -> 1.4)
      expect(breakdown.proteinTef).toBe(66);
      expect(breakdown.carbsTef).toBe(13.8);
      expect(breakdown.fatTef).toBe(1.4);
      expect(breakdown.totalTef).toBe(81);
    });
  });

  describe('Total Daily Energy Expenditure (TDEE) Engine', () => {
    const dummyMeals: MealRecord[] = [
      {
        id: 'm1',
        timestamp: '2026-09-30T18:00:00.000Z',
        date: '2026-09-30',
        mealType: 'dinner',
        title: 'Steak & Potato',
        items: [],
        totalCalories: 800,
        totalProtein: 60,  // 240 kcal * 0.25 = 60
        totalCarbs: 50,    // 200 kcal * 0.08 = 16
        totalFiber: 5,
        netCarbs: 45,
        totalFat: 30       // 270 kcal * 0.02 = 5.4 -> total TEF = 81
      }
    ];

    it('calculates full resting TDEE in standard manual mode: BMR + NEAT + EAT + TEF', () => {
      const bmr = 1800;
      const activeCalories = 400; // EAT workout
      const tdee = calculateTDEE({
        bmr,
        activeCalories,
        meals: dummyMeals,
        source: 'manual',
        includeResting: true
      });

      // BMR: 1800
      // NEAT: 1800 * 0.15 = 270
      // EAT: 400
      // TEF: 81
      // Total Burned: 1800 + 270 + 400 + 81 = 2551
      expect(tdee.bmr).toBe(1800);
      expect(tdee.neat).toBe(270);
      expect(tdee.eat).toBe(400);
      expect(tdee.tef).toBe(81);
      expect(tdee.totalBurned).toBe(2551);
      expect(tdee.isGoogleFit).toBe(false);
    });

    it('calculates active-only TDEE when includeResting is false: EAT + TEF', () => {
      const tdee = calculateTDEE({
        bmr: 1800,
        activeCalories: 500,
        meals: dummyMeals,
        includeResting: false
      });

      expect(tdee.bmr).toBe(0);
      expect(tdee.neat).toBe(0);
      expect(tdee.eat).toBe(500);
      expect(tdee.tef).toBe(81);
      expect(tdee.totalBurned).toBe(581);
    });

    it('calculates Google Fit integrated TDEE: Google Fit Burn + TEF without double-counting NEAT', () => {
      const fitTrackedBurn = 2200; // Google Fit comprehensive sensor burn
      const tdee = calculateTDEE({
        bmr: 1800,
        activeCalories: fitTrackedBurn,
        meals: dummyMeals,
        isGoogleFitConnected: true,
        source: 'google_fit'
      });

      expect(tdee.isGoogleFit).toBe(true);
      expect(tdee.neat).toBe(0); // 0 added to avoid double counting
      expect(tdee.eat).toBe(2200);
      expect(tdee.tef).toBe(81);
      expect(tdee.totalBurned).toBe(2281); // 2200 + 81
    });

    it('calculates Android Health Connect integrated TDEE: Health Connect Burn + TEF without double-counting NEAT', () => {
      const hcBurn = 2450; // Android Health Connect wearable tracked active + resting burn
      const tdee = calculateTDEE({
        bmr: 1800,
        activeCalories: hcBurn,
        meals: dummyMeals,
        isHealthConnectConnected: true,
        source: 'health_connect'
      });

      expect(tdee.isHealthConnect).toBe(true);
      expect(tdee.neat).toBe(0); // 0 added to prevent double counting
      expect(tdee.eat).toBe(2450);
      expect(tdee.tef).toBe(81);
      expect(tdee.totalBurned).toBe(2531); // 2450 + 81
    });
  });
});
