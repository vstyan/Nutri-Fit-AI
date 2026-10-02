import { describe, it, expect } from 'vitest';
import { buildDailyCoachPayload } from '../utils/coachAggregator';
import { DailySummary, AppSettings, DailyActivity } from '../types';

describe('coachAggregator - Active Calories vs Resting BMR Isolation', () => {
  const baseSettings: AppSettings = {
    geminiApiKey: 'test-api-key',
    storageLocation: 'local_indexeddb',
    storagePromptDismissed: true,
    includeRestingCalories: true,
    profile: {
      gender: 'male',
      age: 35,
      weightKg: 75,
      heightCm: 178,
      unitSystem: 'imperial'
    },
    goals: {
      dailyCaloriesTarget: 2200,
      dailyCarbsTarget: 220,
      dailyFiberTarget: 35,
      dailyProteinTarget: 150,
      dailyFatTarget: 70,
      dailyCholesterolTarget: 300,
      primaryGoals: ['Build muscle & strength', 'Lower LDL cholesterol & heart health']
    }
  };

  it('isolates true active calories (229 kcal) and does NOT flag a workout when Health Connect has 1070 total calories', () => {
    // Exact user scenario from screenshot:
    // Health Connect: 1070 kcal total (229 active + 841 rest), TEF = 209 kcal, Total TDEE = 1279 kcal
    const hcActivity: DailyActivity = {
      date: '2026-10-02',
      activeCaloriesBurned: 1070,
      baseBmrCalories: 841,
      neatCalories: 0,
      tefCalories: 209,
      totalCaloriesBurned: 1279,
      source: 'health_connect',
      sensorActiveCalories: 229,
      sensorRestingCalories: 841,
      lastUpdated: new Date().toISOString()
    };

    const summary: DailySummary = {
      date: '2026-10-02',
      meals: [],
      activity: hcActivity,
      totals: {
        calories: 1952,
        carbs: 180,
        fiber: 32,
        netCarbs: 148,
        protein: 142,
        fat: 55,
        tef: 209
      },
      netCalories: 1952 - 1279
    };

    const trackerSettings: AppSettings = {
      ...baseSettings,
      healthConnectConnected: true,
      burnTrackingMode: 'tracker'
    };

    const payload = buildDailyCoachPayload('2026-10-02', summary, trackerSettings);

    // CRITICAL: activeCalories must ONLY be 229 active kcal, NEVER 1070 or 1279
    expect(payload.todayExpenditure.activeCalories).toBe(229);
    expect(payload.todayExpenditure.bmrCalories).toBe(841);
    expect(payload.todayExpenditure.totalBurned).toBe(1279);

    // CRITICAL: No workout detected since no itemized workout session was logged
    expect(payload.todayExpenditure.hasSignificantWorkout).toBe(false);

    // Summary must reference the 229 active kcal and clarify it is routine activity, not a dedicated workout session
    expect(payload.todayExpenditure.workoutSummary).toContain('229 active kcal');
    expect(payload.todayExpenditure.workoutSummary).toContain('No dedicated high-intensity workout session was logged');
    expect(payload.todayExpenditure.workoutSummary).not.toContain('Manual workout/exercise burn entered: 1000');
    expect(payload.todayExpenditure.workoutSummary).not.toContain('Manual workout/exercise burn entered: 1070');

    // Guidance for AI must strictly forbid claiming 1279 or 1070 is a single workout
    expect(payload.dayPacingContext.guidanceForAI).toContain('229 active kcal');
    expect(payload.dayPacingContext.guidanceForAI).toContain('Do NOT claim or hallucinate that the user burned');
  });

  it('detects dedicated workouts and combines with tracker active burn appropriately', () => {
    const hcActivityWithWorkout: DailyActivity = {
      date: '2026-10-02',
      activeCaloriesBurned: 1200,
      baseBmrCalories: 800,
      neatCalories: 0,
      tefCalories: 150,
      totalCaloriesBurned: 1350,
      source: 'health_connect',
      sensorActiveCalories: 400,
      sensorRestingCalories: 800,
      workouts: [
        {
          id: 'w1',
          title: 'Tempo Run',
          caloriesBurned: 350,
          durationMinutes: 30,
          intensity: 'high',
          description: 'Morning tempo run',
          timestamp: '2026-10-02T08:00:00.000Z'
        }
      ],
      lastUpdated: new Date().toISOString()
    };

    const summary: DailySummary = {
      date: '2026-10-02',
      meals: [],
      activity: hcActivityWithWorkout,
      totals: {
        calories: 1500,
        carbs: 150,
        fiber: 25,
        netCarbs: 125,
        protein: 110,
        fat: 45
      },
      netCalories: 1500 - 1350
    };

    const trackerSettings: AppSettings = {
      ...baseSettings,
      healthConnectConnected: true,
      burnTrackingMode: 'tracker'
    };

    const payload = buildDailyCoachPayload('2026-10-02', summary, trackerSettings);

    expect(payload.todayExpenditure.hasSignificantWorkout).toBe(true);
    expect(payload.todayExpenditure.activeCalories).toBe(400); // Total tracker active movement
    expect(payload.todayExpenditure.workoutSummary).toContain('Tempo Run');
    expect(payload.todayExpenditure.workoutSummary).toContain('350 active kcal');
  });

  it('correctly handles manual standalone mode with significant workout entered', () => {
    const manualActivity: DailyActivity = {
      date: '2026-10-02',
      activeCaloriesBurned: 450,
      baseBmrCalories: 1700,
      neatCalories: 255,
      tefCalories: 150,
      totalCaloriesBurned: 2555,
      source: 'manual',
      lastUpdated: new Date().toISOString()
    };

    const summary: DailySummary = {
      date: '2026-10-02',
      meals: [],
      activity: manualActivity,
      totals: {
        calories: 2000,
        carbs: 200,
        fiber: 30,
        netCarbs: 170,
        protein: 130,
        fat: 60
      },
      netCalories: 2000 - 2555
    };

    const payload = buildDailyCoachPayload('2026-10-02', summary, baseSettings);

    expect(payload.todayExpenditure.activeCalories).toBe(450);
    expect(payload.todayExpenditure.hasSignificantWorkout).toBe(true);
    expect(payload.todayExpenditure.workoutSummary).toContain('Manual workout/exercise burn entered: 450 active kcal');
  });

  it('correctly handles manual standalone mode on rest day (< 150 kcal)', () => {
    const manualActivity: DailyActivity = {
      date: '2026-10-02',
      activeCaloriesBurned: 50,
      baseBmrCalories: 1700,
      neatCalories: 255,
      tefCalories: 150,
      totalCaloriesBurned: 2155,
      source: 'manual',
      lastUpdated: new Date().toISOString()
    };

    const summary: DailySummary = {
      date: '2026-10-02',
      meals: [],
      activity: manualActivity,
      totals: {
        calories: 1800,
        carbs: 180,
        fiber: 28,
        netCarbs: 152,
        protein: 120,
        fat: 55
      },
      netCalories: 1800 - 2155
    };

    const payload = buildDailyCoachPayload('2026-10-02', summary, baseSettings);

    expect(payload.todayExpenditure.activeCalories).toBe(50);
    expect(payload.todayExpenditure.hasSignificantWorkout).toBe(false);
    expect(payload.todayExpenditure.workoutSummary).toContain('Baseline activity: 50 active kcal');
  });
});
