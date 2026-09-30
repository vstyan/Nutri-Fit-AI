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
    const res = await Health.isAvailable();
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
      read: ['calories', 'totalCalories', 'steps', 'workouts'],
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
    const avail = await Health.isAvailable();
    if (!avail?.available) {
      return {
        isNative: true,
        platform: 'android',
        isHealthConnectSupported: false,
        isAuthorized: false,
        error: avail?.reason || 'Health Connect not supported or not installed'
      };
    }

    const auth = await Health.checkAuthorization({
      read: ['calories', 'totalCalories', 'steps', 'workouts']
    });

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
 * Synchronizes daily health metrics (active calories, total calories, and steps) for a specific date (YYYY-MM-DD)
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
    let steps = 0;

    // 1. Query Active Calories
    try {
      const activeRes = await Health.queryAggregated({
        dataType: 'calories',
        startDate,
        endDate,
        bucket: 'day',
        aggregation: 'sum'
      });
      if (activeRes?.samples && activeRes.samples.length > 0) {
        activeCalories = Math.round(activeRes.samples.reduce((s, item) => s + (item.value || 0), 0));
      }
    } catch (e) {
      console.warn('[HealthBridge] Query active calories failed:', e);
    }

    // 2. Query Total Calories
    try {
      const totalRes = await Health.queryAggregated({
        dataType: 'totalCalories',
        startDate,
        endDate,
        bucket: 'day',
        aggregation: 'sum'
      });
      if (totalRes?.samples && totalRes.samples.length > 0) {
        totalCalories = Math.round(totalRes.samples.reduce((s, item) => s + (item.value || 0), 0));
      }
    } catch (e) {
      // Total calories might not be recorded by all devices; fallback to active calories
      console.warn('[HealthBridge] Query total calories failed:', e);
    }

    // 3. Query Steps
    try {
      const stepsRes = await Health.queryAggregated({
        dataType: 'steps',
        startDate,
        endDate,
        bucket: 'day',
        aggregation: 'sum'
      });
      if (stepsRes?.samples && stepsRes.samples.length > 0) {
        steps = Math.round(stepsRes.samples.reduce((s, item) => s + (item.value || 0), 0));
      }
    } catch (e) {
      console.warn('[HealthBridge] Query steps failed:', e);
    }

    // If total calories was not reported separately, fallback to active calories
    if (totalCalories <= 0 && activeCalories > 0) {
      totalCalories = activeCalories;
    }

    return {
      date: dateStr,
      activeCalories,
      totalCalories,
      steps,
      source: 'health_connect',
      lastSyncedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[HealthBridge] syncHealthConnectDaily failed for ' + dateStr, err);
    return null;
  }
}
