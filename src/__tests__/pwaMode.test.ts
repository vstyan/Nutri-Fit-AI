import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNativeAndroid } from '../services/healthBridge';
import { getEffectiveTrackingMode, calculateTDEE } from '../utils/calorieEngine';
import { buildDailyCoachPayload } from '../utils/coachAggregator';
import { scaleFoodItems } from '../utils/portionScaler';
import { AppSettings, DailySummary, FoodItem } from '../types';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
    getPlatform: vi.fn()
  }
}));

describe('PWA Platform & Functionality Test Suite', () => {
  const basePwaSettings: AppSettings = {
    geminiApiKey: '',
    storageLocation: 'local_indexeddb',
    storagePromptDismissed: true,
    profile: {
      age: 35,
      gender: 'male',
      weightKg: 80,
      heightCm: 180,
      unitSystem: 'metric'
    },
    goals: {
      dailyCaloriesTarget: 2000,
      dailyProteinTarget: 150,
      dailyCarbsTarget: 200,
      dailyFiberTarget: 30,
      dailyFatTarget: 65,
      primaryGoals: ['Fat Loss', 'Maintain Muscle']
    },
    themeMode: 'pure_black',
    includeRestingCalories: true,
    burnTrackingMode: 'standalone',
    healthConnectConnected: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate web / PWA browser environment
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
  });

  describe('PWA Environment Detection', () => {
    it('correctly identifies environment as non-native web/PWA browser', () => {
      expect(isNativeAndroid()).toBe(false);
    });
  });

  describe('PWA Tracking Mode Enforcement', () => {
    it('always enforces standalone mode on PWA even if settings contain tracker mode', () => {
      const trackerSettings: AppSettings = {
        ...basePwaSettings,
        burnTrackingMode: 'tracker',
        healthConnectConnected: true
      };

      const effectiveMode = getEffectiveTrackingMode(trackerSettings, false);
      expect(effectiveMode).toBe('standalone');
    });

    it('defaults to standalone mode when isNative is false and settings are undefined', () => {
      expect(getEffectiveTrackingMode(undefined, false)).toBe('standalone');
    });
  });

  describe('PWA Calorie & TDEE Calculations (Standalone Mode)', () => {
    it('computes full 24h TDEE as BMR + NEAT + EAT + TEF in PWA mode', () => {
      // BMR for 35yo, 80kg, 180cm male ≈ 1762 kcal
      const bmr = 1762;
      const workoutBurn = 450; // Manual or Voice workout logged in PWA
      const meals = [
        {
          id: 'meal-1',
          timestamp: new Date().toISOString(),
          date: '2026-10-02',
          mealType: 'lunch' as const,
          title: 'Chicken and Rice',
          items: [],
          totalCarbs: 60,
          totalFiber: 5,
          netCarbs: 55,
          totalProtein: 40,
          totalFat: 15,
          totalCalories: 535,
          isFavorite: false
        }
      ];

      const tdee = calculateTDEE({
        bmr,
        activeCalories: workoutBurn,
        meals,
        source: 'manual',
        trackingMode: 'standalone',
        includeResting: true
      });

      // NEAT = 15% of 1762 ≈ 264
      expect(tdee.neat).toBe(264);
      // EAT = workout calories = 450
      expect(tdee.eat).toBe(450);
      // TEF = 40*4*0.25 (40) + 60*4*0.08 (19) + 15*9*0.02 (3) = 62
      expect(tdee.tef).toBe(62);
      // Total Burned = 1762 (BMR) + 264 (NEAT) + 450 (EAT) + 62 (TEF) = 2538
      expect(tdee.totalBurned).toBe(1762 + 264 + 450 + 62);
      expect(tdee.isHealthConnect).toBeFalsy();
    });
  });

  describe('PWA AI Coach Integration', () => {
    it('correctly aggregates active workouts without confounding resting BMR', () => {
      const summary: DailySummary = {
        date: '2026-10-02',
        meals: [
          {
            id: 'm1',
            timestamp: new Date().toISOString(),
            date: '2026-10-02',
            mealType: 'breakfast',
            title: 'Oatmeal & Whey',
            items: [],
            totalCarbs: 45,
            totalFiber: 6,
            netCarbs: 39,
            totalProtein: 30,
            totalFat: 6,
            totalCalories: 354,
            isFavorite: false
          }
        ],
        activity: {
          date: '2026-10-02',
          activeCaloriesBurned: 400, // 400 kcal workout entered in PWA
          baseBmrCalories: 1762,
          neatCalories: 264,
          tefCalories: 35,
          totalCaloriesBurned: 1762 + 264 + 400 + 35,
          source: 'manual',
          lastUpdated: '2026-10-02T16:45:00.000Z',
          workouts: [
            {
              id: 'w1',
              timestamp: '2026-10-02T16:00:00.000Z',
              title: 'Weightlifting & Cardio',
              description: 'Strength and interval training',
              durationMinutes: 45,
              caloriesBurned: 400,
              intensity: 'vigorous'
            }
          ]
        },
        totals: {
          calories: 354,
          carbs: 45,
          fiber: 6,
          netCarbs: 39,
          protein: 30,
          fat: 6,
          tef: 35
        },
        netCalories: 354 - (1762 + 264 + 400 + 35)
      };

      const payload = buildDailyCoachPayload('2026-10-02', summary, basePwaSettings);

      expect(payload.todayExpenditure.activeBurnSource).toBe('manual');
      expect(payload.todayExpenditure.activeCalories).toBe(400);
      expect(payload.todayExpenditure.bmrCalories).toBe(1762);
      expect(payload.todayExpenditure.neatCalories).toBe(264);
      expect(payload.todayExpenditure.hasSignificantWorkout).toBe(true);
      expect(payload.todayExpenditure.workoutSummary).toContain('Weightlifting & Cardio');
    });
  });

  describe('PWA Offline Portion Scaler', () => {
    it('executes 100% offline portion scaling without network requests', () => {
      const items: FoodItem[] = [
        {
          id: 'item-1',
          name: 'Brown Rice',
          portion: '1 cup',
          grams: 195,
          carbs: 45,
          fiber: 4,
          protein: 5,
          fat: 2,
          calories: 218
        },
        {
          id: 'item-2',
          name: 'Chicken Breast',
          portion: '150g',
          grams: 150,
          carbs: 0,
          fiber: 0,
          protein: 46,
          fat: 5,
          calories: 247
        }
      ];

      // Test halving (0.5x)
      const halved = scaleFoodItems(items, 0.5);
      expect(halved[0].grams).toBe(98);
      expect(halved[0].carbs).toBe(22.5);
      expect(halved[0].portion).toBe('0.5 cup');
      expect(halved[1].grams).toBe(75);
      expect(halved[1].protein).toBe(23);
      expect(halved[1].portion).toBe('75g');

      // Test doubling (2.0x)
      const doubled = scaleFoodItems(items, 2.0);
      expect(doubled[0].grams).toBe(390);
      expect(doubled[0].carbs).toBe(90);
      expect(doubled[0].portion).toBe('2 cup');
      expect(doubled[1].grams).toBe(300);
      expect(doubled[1].protein).toBe(92);
      expect(doubled[1].portion).toBe('300g');
    });
  });
});
