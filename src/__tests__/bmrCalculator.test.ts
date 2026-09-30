import { describe, it, expect } from 'vitest';
import { 
  calculateBMR, 
  kgToLbs, 
  lbsToKg, 
  cmToFeetInches, 
  feetInchesToCm 
} from '../utils/bmrCalculator';
import { UserProfile } from '../types';

describe('BMR & Unit Conversion Calculations (Baseline)', () => {
  describe('Mifflin-St Jeor BMR Equation', () => {
    it('calculates accurate BMR for adult male (metric)', () => {
      // Male: (10 * 80kg) + (6.25 * 180cm) - (5 * 30y) + 5 = 800 + 1125 - 150 + 5 = 1780
      const profile: UserProfile = {
        gender: 'male',
        age: 30,
        weightKg: 80,
        heightCm: 180,
        unitSystem: 'metric'
      };
      expect(calculateBMR(profile)).toBe(1780);
    });

    it('calculates accurate BMR for adult female (metric)', () => {
      // Female: (10 * 65kg) + (6.25 * 165cm) - (5 * 28y) - 161 = 650 + 1031.25 - 140 - 161 = 1380.25 -> 1380
      const profile: UserProfile = {
        gender: 'female',
        age: 28,
        weightKg: 65,
        heightCm: 165,
        unitSystem: 'metric'
      };
      expect(calculateBMR(profile)).toBe(1380);
    });

    it('enforces safety minimum floor of 800 kcal', () => {
      const extremeProfile: UserProfile = {
        gender: 'female',
        age: 95,
        weightKg: 30,
        heightCm: 130,
        unitSystem: 'metric'
      };
      // (10 * 30) + (6.25 * 130) - (5 * 95) - 161 = 300 + 812.5 - 475 - 161 = 476.5 -> floor is 800
      expect(calculateBMR(extremeProfile)).toBe(800);
    });

    it('provides sensible fallback baseline (1700 kcal) for missing or invalid inputs', () => {
      const invalidProfile: UserProfile = {
        gender: 'male',
        age: 0,
        weightKg: 0,
        heightCm: 0,
        unitSystem: 'metric'
      };
      expect(calculateBMR(invalidProfile)).toBe(1700);
    });
  });

  describe('Weight & Height Unit Converters', () => {
    it('accurately converts kg to lbs and vice versa', () => {
      expect(kgToLbs(70)).toBe(154.3);
      expect(lbsToKg(154.3)).toBe(70.0);
      expect(kgToLbs(100)).toBe(220.5);
      expect(lbsToKg(220.462)).toBe(100.0);
    });

    it('accurately converts cm to feet and inches', () => {
      // 180 cm = 70.866 inches -> 5 ft 11 in
      expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
      // 175 cm = 68.897 inches -> 5 ft 9 in
      expect(cmToFeetInches(175)).toEqual({ feet: 5, inches: 9 });
      // 183 cm = 72.047 inches -> 6 ft 0 in
      expect(cmToFeetInches(183)).toEqual({ feet: 6, inches: 0 });
    });

    it('accurately converts feet and inches to cm', () => {
      // 5 ft 11 in = 71 in * 2.54 = 180.34 cm -> 180 cm
      expect(feetInchesToCm(5, 11)).toBe(180);
      // 6 ft 0 in = 72 in * 2.54 = 182.88 cm -> 183 cm
      expect(feetInchesToCm(6, 0)).toBe(183);
      // 5 ft 4 in = 64 in * 2.54 = 162.56 cm -> 163 cm
      expect(feetInchesToCm(5, 4)).toBe(163);
    });
  });
});
