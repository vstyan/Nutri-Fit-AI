/**
 * NutriFit AI - Calorie Calculation Engine
 * 
 * Total Daily Energy Expenditure (TDEE) Model:
 * Total Burned = BMR + NEAT + EAT + TEF
 * 
 * Components:
 * 1. BMR (Basal Metabolic Rate): Energy expended at rest (Mifflin-St Jeor equation).
 * 2. NEAT (Non-Exercise Activity Thermogenesis): Spontaneous daily physical activity (e.g. fidgeting, walking).
 *    - Google Fit integration: No action required (0 added) as Google Fit already accounts for NEAT and steps.
 *    - Manual entry: Provides a baseline sedentary NEAT floor (BMR * 0.15).
 * 3. EAT (Exercise Activity Thermogenesis): Structured workout & exercise calories.
 * 4. TEF (Thermic Effect of Food): Energy required for food digestion & nutrient processing.
 *    - Calculated dynamically from logged nutrition:
 *      TEF = (Protein Calories * 0.25) + (Carbohydrate Calories * 0.08) + (Fat Calories * 0.02)
 *    - Where:
 *      * Protein Calories = Protein (g) * 4
 *      * Carbohydrate Calories = Carbohydrates (g) * 4
 *      * Fat Calories = Fat (g) * 9
 *    - If individual macronutrients are missing but total calories is known, falls back to 10% baseline.
 */

import { MealRecord, FoodItem, UserProfile } from '../types';
import { calculateBMR } from './bmrCalculator';
export { calculateBMR } from './bmrCalculator';

export interface TEFBreakdown {
  proteinTef: number;
  carbsTef: number;
  fatTef: number;
  totalTef: number;
}

export interface TDEEBreakdown {
  bmr: number;        // Rest (Basal Metabolic Rate)
  neat: number;       // Non-Exercise Activity Thermogenesis
  eat: number;        // Exercise Activity Thermogenesis (active workouts/exercise)
  tef: number;        // Thermic Effect of Food
  totalBurned: number;// Total = BMR + NEAT + EAT + TEF (or Google Fit total + TEF)
  isGoogleFit: boolean;
}

/**
 * Calculates TEF from macro calories directly:
 * TEF = (Protein Calories * 0.25) + (Carbohydrate Calories * 0.08) + (Fat Calories * 0.02)
 */
export function calculateTEFFromMacroCalories(
  proteinCalories: number,
  carbsCalories: number,
  fatCalories: number,
  fallbackCalories: number = 0
): TEFBreakdown {
  const pCal = Math.max(0, Number(proteinCalories) || 0);
  const cCal = Math.max(0, Number(carbsCalories) || 0);
  const fCal = Math.max(0, Number(fatCalories) || 0);

  const hasMacros = (pCal > 0 || cCal > 0 || fCal > 0);

  if (hasMacros) {
    const proteinTef = Math.round(pCal * 0.25 * 10) / 10;
    const carbsTef = Math.round(cCal * 0.08 * 10) / 10;
    const fatTef = Math.round(fCal * 0.02 * 10) / 10;
    const totalTef = Math.round(proteinTef + carbsTef + fatTef);

    return {
      proteinTef,
      carbsTef,
      fatTef,
      totalTef
    };
  }

  // Fallback when macros are not available but total calories is provided
  const fallback = Math.max(0, Number(fallbackCalories) || 0);
  const fallbackTef = Math.round(fallback * 0.10);
  return {
    proteinTef: 0,
    carbsTef: 0,
    fatTef: 0,
    totalTef: fallbackTef
  };
}

/**
 * Calculates Thermic Effect of Food (TEF) breakdown from macronutrient quantities (grams).
 * Formula:
 * - Protein Calories = protein_g * 4
 * - Carbohydrate Calories = carbs_g * 4
 * - Fat Calories = fat_g * 9
 * - TEF = (Protein Calories * 0.25) + (Carbohydrate Calories * 0.08) + (Fat Calories * 0.02)
 */
export function calculateTEFBreakdown(
  proteinGrams: number,
  carbsGrams: number,
  fatGrams: number,
  totalCalories: number = 0
): TEFBreakdown {
  const p = Math.max(0, Number(proteinGrams) || 0);
  const c = Math.max(0, Number(carbsGrams) || 0);
  const f = Math.max(0, Number(fatGrams) || 0);
  const cal = Math.max(0, Number(totalCalories) || 0);

  const proteinCalories = p * 4;
  const carbsCalories = c * 4;
  const fatCalories = f * 9;

  return calculateTEFFromMacroCalories(proteinCalories, carbsCalories, fatCalories, cal);
}

/**
 * Calculates TEF breakdown for an individual food item.
 */
export function calculateFoodItemTEF(item: FoodItem): TEFBreakdown {
  if (!item) {
    return { proteinTef: 0, carbsTef: 0, fatTef: 0, totalTef: 0 };
  }
  return calculateTEFBreakdown(
    Number(item.protein) || 0,
    Number(item.carbs) || 0,
    Number(item.fat) || 0,
    Number(item.calories) || 0
  );
}

/**
 * Calculates TEF breakdown for a single meal record.
 * Inspects meal-level macros, and if empty/0, aggregates from individual items.
 */
export function calculateMealTEFBreakdown(meal: MealRecord): TEFBreakdown {
  if (!meal) {
    return { proteinTef: 0, carbsTef: 0, fatTef: 0, totalTef: 0 };
  }

  let p = Number(meal.totalProtein) || 0;
  let c = Number(meal.totalCarbs) || 0;
  let f = Number(meal.totalFat) || 0;
  let cal = Number(meal.totalCalories) || 0;

  // If top-level macros are 0/missing but food items are present, aggregate from items
  if (p === 0 && c === 0 && f === 0 && Array.isArray(meal.items) && meal.items.length > 0) {
    for (const item of meal.items) {
      p += Number(item.protein) || 0;
      c += Number(item.carbs) || 0;
      f += Number(item.fat) || 0;
      cal += Number(item.calories) || 0;
    }
  }

  return calculateTEFBreakdown(p, c, f, cal);
}

/**
 * Calculates TEF for a single meal record.
 */
export function calculateMealTEF(meal: MealRecord): number {
  return calculateMealTEFBreakdown(meal).totalTef;
}

/**
 * Calculates daily total Thermic Effect of Food (TEF) breakdown dynamically from logged meals.
 * Automatically updates whenever meals or items are added, modified, or deleted.
 */
export function calculateDailyTEFBreakdown(meals: MealRecord[]): TEFBreakdown {
  if (!meals || meals.length === 0) {
    return { proteinTef: 0, carbsTef: 0, fatTef: 0, totalTef: 0 };
  }

  let proteinTef = 0;
  let carbsTef = 0;
  let fatTef = 0;
  let totalTef = 0;

  for (const meal of meals) {
    const b = calculateMealTEFBreakdown(meal);
    proteinTef += b.proteinTef;
    carbsTef += b.carbsTef;
    fatTef += b.fatTef;
    totalTef += b.totalTef;
  }

  return {
    proteinTef: Math.round(proteinTef * 10) / 10,
    carbsTef: Math.round(carbsTef * 10) / 10,
    fatTef: Math.round(fatTef * 10) / 10,
    totalTef: Math.round(totalTef)
  };
}

/**
 * Calculates daily total Thermic Effect of Food (TEF) dynamically from logged meals.
 * Updates automatically whenever meals are added, modified, or deleted.
 */
export function calculateDailyTEF(meals: MealRecord[]): number {
  return calculateDailyTEFBreakdown(meals).totalTef;
}

/**
 * Non-Exercise Activity Thermogenesis (NEAT) calculation:
 * - When pulling data from Google Fit: 0 added (no action required, Google Fit already accounts for NEAT).
 * - When relying on manual entry: Provides a baseline sedentary NEAT floor (BMR * 0.15).
 */
export function calculateNEAT(params: {
  bmr: number;
  source?: 'manual' | 'google_fit';
  isGoogleFitConnected?: boolean;
  includeResting?: boolean;
}): number {
  const { bmr, source, isGoogleFitConnected = false, includeResting = true } = params;

  // Google Fit already measures NEAT (steps, incidental movement) in its tracked data
  if (source === 'google_fit' || isGoogleFitConnected) {
    return 0;
  }

  // If user explicitly excluded resting calories / using external tracker total
  if (!includeResting) {
    return 0;
  }

  // Baseline sedentary NEAT floor for manual tracking: 15% of BMR
  return Math.max(0, Math.round(bmr * 0.15));
}

/**
 * Total Daily Energy Expenditure (TDEE) calculation engine:
 * Total Burned = BMR + NEAT + EAT + TEF
 */
export function calculateTDEE(params: {
  bmr: number;
  activeCalories: number; // manual workout calories (EAT) or Google Fit tracked calories
  meals: MealRecord[];
  source?: 'manual' | 'google_fit';
  isGoogleFitConnected?: boolean;
  includeResting?: boolean;
}): TDEEBreakdown {
  const {
    bmr,
    activeCalories,
    meals,
    source,
    isGoogleFitConnected = false,
    includeResting = true
  } = params;

  const isGoogleFit = source === 'google_fit' || isGoogleFitConnected;
  const tef = calculateDailyTEF(meals);

  if (isGoogleFit) {
    // Google Fit already accounts for BMR, NEAT, and EAT in its tracked total.
    // NEAT is 0 added to prevent double counting.
    // Total Burned = Google Fit burn + TEF.
    const fitTotal = Math.round(activeCalories);
    return {
      bmr: includeResting ? bmr : 0,
      neat: 0,
      eat: fitTotal,
      tef,
      totalBurned: fitTotal + tef,
      isGoogleFit: true
    };
  }

  if (!includeResting) {
    // Manual external tracker mode (user logs single full-day burn from tracker)
    const trackerTotal = Math.round(activeCalories);
    return {
      bmr: 0,
      neat: 0,
      eat: trackerTotal,
      tef,
      totalBurned: trackerTotal + tef,
      isGoogleFit: false
    };
  }

  // Standard manual mode: Total Burned = BMR + NEAT + EAT + TEF
  const neat = Math.max(0, Math.round(bmr * 0.15)); // baseline sedentary NEAT floor (15% BMR)
  const eat = Math.max(0, Math.round(activeCalories));
  const totalBurned = bmr + neat + eat + tef;

  return {
    bmr,
    neat,
    eat,
    tef,
    totalBurned,
    isGoogleFit: false
  };
}
