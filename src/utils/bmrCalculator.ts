import { UserProfile } from '../types';

/**
 * Calculates Basal Metabolic Rate (BMR) using the Mifflin-St Jeor Equation.
 * 
 * Formula:
 * - Men:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
 * - Women: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
 */
export function calculateBMR(profile: UserProfile): number {
  const { gender, age, weightKg, heightCm } = profile;

  if (!age || age <= 0 || !weightKg || weightKg <= 0 || !heightCm || heightCm <= 0) {
    return 1700; // sensible default baseline
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'female' ? base - 161 : base + 5;
  return Math.max(800, Math.round(bmr));
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = (feet * 12) + inches;
  return Math.round(totalInches * 2.54);
}
