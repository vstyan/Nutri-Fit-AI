/**
 * NutriFit AI - Health Bridge Service
 * 
 * Provides a unified abstraction layer for health and fitness data synchronization:
 * - On Native Android (via Capacitor APK): Interacts with Android Health Connect via @capgo/capacitor-health.
 * - On Web / iOS PWA: Gracefully reports native health as unavailable, allowing standard Google Fit REST or manual tracking.
 */

import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export interface HealthDailySummary {
  date: string; // YYYY-MM-DD
  activeCalories: number; // Active energy burned (EAT/active calories)
  totalCalories: number; // Total energy burned including resting (if provided by wearable)
  basalCalories?: number; // Basal metabolic rate if recorded by wearable
  steps: number;
  source: 'health_connect' | 'google_fit' | 'manual';
  lastSyncedAt: string; // ISO string
}

export interface HealthBridgeStatus {
  isNative: boolean;
  platform: string;
  isHealthConnectSupported: boolean;
  isAuthorized: boolean;
  error?: string;
}

/**
 * Timeout safety helper ensuring native plugin calls never hang or block the app
 */
async function withTimeout<T>(promise: Promise<T>, ms: number = 4000, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[HealthBridge] Operation timed out after ${ms}ms`);
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    console.warn('[HealthBridge] Operation rejected:', err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks whether the app is currently running inside the native Android APK container
 */
export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/**
 * Checks whether native health tracking (e.g. Health Connect on Android) is available on this device
 */
export async function isHealthConnectAvailable(): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    const res = await withTimeout(Health.isAvailable(), 3000, { available: false, reason: 'timeout' });
    return Boolean(res?.available);
  } catch (err) {
    console.warn('[HealthBridge] isAvailable check failed:', err);
    return false;
  }
}

/**
 * Requests Health Connect read permissions from the user via the native Android permission sheet
 */
export async function requestHealthConnectPermissions(): Promise<{
  success: boolean;
  authorizedTypes: string[];
  error?: string;
}> {
  if (!isNativeAndroid()) {
    return { success: false, authorizedTypes: [], error: 'Not running in native Android environment' };
  }

  try {
    const status = await Health.requestAuthorization({
      read: ['calories', 'totalCalories', 'basalCalories', 'steps', 'workouts'],
      write: []
    });

    const authorized = status.readAuthorized || [];
    const hasCalorieAuth = authorized.includes('calories') || authorized.includes('totalCalories');

    return {
      success: authorized.length > 0 || hasCalorieAuth,
      authorizedTypes: authorized
    };
  } catch (err: any) {
    console.error('[HealthBridge] requestAuthorization error:', err);
    return {
      success: false,
      authorizedTypes: [],
      error: err?.message || 'Failed to request Health Connect permissions'
    };
  }
}

/**
 * Checks existing Health Connect authorization without prompting the user
 */
export async function checkHealthConnectStatus(): Promise<HealthBridgeStatus> {
  const native = isNativeAndroid();
  if (!native) {
    return {
      isNative: false,
      platform: 'web',
      isHealthConnectSupported: false,
      isAuthorized: false
    };
  }

  try {
    const avail = await withTimeout(Health.isAvailable(), 3000, { available: false, reason: 'timeout' });
    if (!avail?.available) {
      return {
        isNative: true,
        platform: 'android',
        isHealthConnectSupported: false,
        isAuthorized: false,
        error: avail?.reason || 'Health Connect not supported or not installed'
      };
    }

    const auth = await withTimeout(
      Health.checkAuthorization({
        read: ['calories', 'totalCalories', 'basalCalories', 'steps', 'workouts']
      }),
      3000,
      { readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: [] }
    );

    const isAuth = (auth.readAuthorized && auth.readAuthorized.length > 0);

    return {
      isNative: true,
      platform: 'android',
      isHealthConnectSupported: true,
      isAuthorized: isAuth
    };
  } catch (err: any) {
    return {
      isNative: true,
      platform: 'android',
      isHealthConnectSupported: false,
      isAuthorized: false,
      error: err?.message
    };
  }
}

/**
 * Opens Android Health Connect settings so user can manage permissions or troubleshoot connections
 */
export async function openHealthConnectSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await Health.openHealthConnectSettings();
  } catch (err) {
    console.warn('[HealthBridge] Could not open Health Connect settings:', err);
  }
}

/**
 * Synchronizes daily health metrics (active calories, total calories, basal calories, and steps) for a specific date (YYYY-MM-DD)
 */
export async function syncHealthConnectDaily(dateStr: string): Promise<HealthDailySummary | null> {
  if (!isNativeAndroid()) {
    return null;
  }

  try {
    // Construct local midnight to end-of-day boundaries
    const [year, month, day] = dateStr.split('-').map(Number);
    const startObj = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endObj = new Date(year, month - 1, day, 23, 59, 59, 999);

    const startDate = startObj.toISOString();
    const endDate = endObj.toISOString();

    let activeCalories = 0;
    let totalCalories = 0;
    let basalCalories = 0;
    let steps = 0;

    // 1. Query Active Calories (ActiveCaloriesBurnedRecord)
    try {
      const activeRes = await withTimeout(
        Health.queryAggregated({
          dataType: 'calories',
          startDate,
          endDate,
          bucket: 'day',
          aggregation: 'sum'
        }),
        4000,
        null
      );
      if (activeRes?.samples && activeRes.samples.length > 0) {
        activeCalories = Math.round(activeRes.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
      }
    } catch (e) {
      console.warn('[HealthBridge] Query active calories aggregated notice:', e);
    }

    // Fallback: If aggregated query returned 0, query individual ActiveCaloriesBurnedRecord samples
    if (activeCalories <= 0) {
      try {
        const activeSamples = await withTimeout(
          Health.readSamples({
            dataType: 'calories',
            startDate,
            endDate,
            limit: 2000
          }),
          4000,
          { samples: [] }
        );
        if (activeSamples?.samples && activeSamples.samples.length > 0) {
          activeCalories = Math.round(activeSamples.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
        }
      } catch (e) {
        console.warn('[HealthBridge] readSamples active calories notice:', e);
      }
    }

    // 2. Query Total Calories (TotalCaloriesBurnedRecord)
    // NOTE: In @capgo/capacitor-health, aggregateMetrics only supports STEPS, DISTANCE, CALORIES, HYDRATION, DIETARY_ENERGY.
    // Querying queryAggregated for totalCalories throws IllegalArgumentException.
    // We query TotalCaloriesBurnedRecord directly via readSamples, which correctly retrieves all recorded energy samples for the day.
    try {
      const totalRes = await withTimeout(
        Health.readSamples({
          dataType: 'totalCalories',
          startDate,
          endDate,
          limit: 5000
        }),
        4000,
        { samples: [] }
      );
      if (totalRes?.samples && totalRes.samples.length > 0) {
        totalCalories = Math.round(totalRes.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
      }
    } catch (e) {
      console.warn('[HealthBridge] readSamples totalCalories notice:', e);
    }

    // 3. Query Basal Metabolic Rate (BasalMetabolicRateRecord)
    // If wearable or Health Connect reports a basal rate in kcal/day, read the latest sample
    try {
      const basalRes = await withTimeout(
        Health.readSamples({
          dataType: 'basalCalories',
          startDate,
          endDate,
          limit: 100
        }),
        4000,
        { samples: [] }
      );
      if (basalRes?.samples && basalRes.samples.length > 0) {
        const lastSample = basalRes.samples[basalRes.samples.length - 1];
        const rate = Number(lastSample?.value) || 0;
        if (rate > 0) {
          basalCalories = Math.round(rate);
        }
      }
    } catch (e) {
      console.warn('[HealthBridge] readSamples basalCalories notice:', e);
    }

    // 4. Query Steps (StepsRecord)
    try {
      const stepsRes = await withTimeout(
        Health.queryAggregated({
          dataType: 'steps',
          startDate,
          endDate,
          bucket: 'day',
          aggregation: 'sum'
        }),
        4000,
        null
      );
      if (stepsRes?.samples && stepsRes.samples.length > 0) {
        steps = Math.round(stepsRes.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
      }
    } catch (e) {
      console.warn('[HealthBridge] Query steps aggregated notice:', e);
    }

    // Fallback: If aggregated query returned 0, query individual StepsRecord samples
    if (steps <= 0) {
      try {
        const stepsSamples = await withTimeout(
          Health.readSamples({
            dataType: 'steps',
            startDate,
            endDate,
            limit: 2000
          }),
          4000,
          { samples: [] }
        );
        if (stepsSamples?.samples && stepsSamples.samples.length > 0) {
          steps = Math.round(stepsSamples.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
        }
      } catch (e) {
        console.warn('[HealthBridge] readSamples steps notice:', e);
      }
    }

    return {
      date: dateStr,
      activeCalories,
      totalCalories,
      basalCalories: basalCalories > 0 ? basalCalories : undefined,
      steps,
      source: 'health_connect',
      lastSyncedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[HealthBridge] syncHealthConnectDaily failed for ' + dateStr, err);
    return null;
  }
}
