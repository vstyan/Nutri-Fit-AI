/**
 * NutriFit AI - Health Bridge Service
 * 
 * Provides a unified abstraction layer for health and fitness data synchronization:
 * - On Native Android (via Capacitor APK): Interacts with Android Health Connect via @capgo/capacitor-health.
 * - On Web / iOS PWA: Gracefully reports native health as unavailable, allowing standard Google Fit REST or manual tracking.
 */

import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { getLocalDateString } from '../utils/dateUtils';

export interface HealthDailySummary {
  date: string; // YYYY-MM-DD
  activeCalories: number; // Active energy burned (EAT/active calories)
  totalCalories: number; // Total energy burned so far today including resting (if provided by wearable)
  projectedTotalCalories?: number; // End-of-day 24h total burn projected by tracker (e.g. Google Fit EOD estimate)
  basalCalories?: number; // Basal metabolic rate if recorded by wearable
  steps: number;
  source: 'health_connect' | 'google_fit' | 'manual';
  lastSyncedAt: string; // ISO string
  diagnostics?: {
    activeCount: number;
    totalCount: number;
    totalSamplesSum: number;
    sources: string[];
    queryMethod: string;
  };
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
    // Construct local midnight boundaries
    const [year, month, day] = dateStr.split('-').map(Number);
    const isToday = (dateStr === getLocalDateString());
    const now = new Date();
    const nowMs = now.getTime();
    const startObj = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endObj = new Date(year, month - 1, day, 23, 59, 59, 999);

    const startDate = startObj.toISOString();
    // For today, query up to the current minute so health engines aggregate what has elapsed so far
    const queryEndDate = isToday ? now.toISOString() : endObj.toISOString();
    const endDate = queryEndDate;

    let activeCalories = 0;
    let totalCalories = 0;
    let projectedTotalCalories: number | undefined;
    let basalCalories = 0;
    let steps = 0;

    let activeSamplesCount = 0;

    // 1. Query Active Calories (ActiveCaloriesBurnedRecord)
    try {
      const activeRes = await withTimeout(
        Health.queryAggregated({
          dataType: 'calories',
          startDate,
          endDate: queryEndDate,
          bucket: 'day',
          aggregation: 'sum'
        }),
        4000,
        null
      );
      if (activeRes?.samples && activeRes.samples.length > 0) {
        activeCalories = Math.round(activeRes.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
        activeSamplesCount = activeRes.samples.length;
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
            endDate: queryEndDate,
            limit: 2000
          }),
          5000,
          { samples: [] }
        );
        if (activeSamples?.samples && activeSamples.samples.length > 0) {
          activeCalories = Math.round(activeSamples.samples.reduce((s: number, item: any) => s + (Number(item.value) || 0), 0));
          activeSamplesCount = activeSamples.samples.length;
        }
      } catch (e) {
        console.warn('[HealthBridge] readSamples active calories notice:', e);
      }
    }

    // 2. Query Total Calories (TotalCaloriesBurnedRecord)
    let rawTotalSamplesCount = 0;
    let rawTotalSamplesSum = 0;
    const detectedSources: string[] = [];
    let queryMethodUsed = 'none';

    // Query raw TotalCaloriesBurnedRecord samples to inspect intervals vs 24h summaries
    try {
      const totalRes = await withTimeout(
        Health.readSamples({
          dataType: 'totalCalories',
          startDate,
          endDate: endObj.toISOString(), // read full set for today to detect both intervals and 24h projections
          limit: 5000
        }),
        7000,
        { samples: [] }
      );

      if (totalRes?.samples && totalRes.samples.length > 0) {
        queryMethodUsed = 'raw_samples';
        rawTotalSamplesCount = totalRes.samples.length;

        // Group samples by data origin (source package name / ID)
        const samplesBySource = new Map<string, any[]>();
        for (const sample of totalRes.samples) {
          const val = Number(sample.value) || 0;
          if (val <= 0) continue;
          rawTotalSamplesSum += val;
          const src = (sample.sourceId || sample.sourceName || 'unknown').toLowerCase();
          if (!samplesBySource.has(src)) {
            samplesBySource.set(src, []);
          }
          samplesBySource.get(src)!.push(sample);
        }

        for (const srcKey of samplesBySource.keys()) {
          if (!detectedSources.includes(srcKey)) detectedSources.push(srcKey);
        }

        // Prioritize source: Google Fit first if present, otherwise the source with the most data
        let selectedSourceKey: string | null = null;
        for (const key of samplesBySource.keys()) {
          if (key.includes('fit') || key.includes('google')) {
            selectedSourceKey = key;
            break;
          }
        }
        if (!selectedSourceKey && samplesBySource.size > 0) {
          let maxCount = 0;
          for (const [k, v] of samplesBySource.entries()) {
            if (v.length > maxCount) {
              maxCount = v.length;
              selectedSourceKey = k;
            }
          }
        }

        if (selectedSourceKey) {
          const sourceSamples = samplesBySource.get(selectedSourceKey) || [];

          // Separate into interval records (< 18h) vs full-day projected records (>= 18h)
          const intervalRecords: any[] = [];
          let fullDayRecord: any = null;

          for (const s of sourceSamples) {
            const start = new Date(s.startDate).getTime();
            const end = new Date(s.endDate).getTime();
            const val = Number(s.value) || 0;
            if (isNaN(start) || isNaN(end) || end <= start || val <= 0) continue;
            // Ignore future intervals starting after now
            if (isToday && start > nowMs) continue;

            const durHours = (end - start) / (1000 * 60 * 60);
            if (durHours >= 18) {
              if (!fullDayRecord || val > fullDayRecord.val) {
                fullDayRecord = { ...s, start, end, val, durHours };
              }
            } else {
              // For intervals that overlap current time, clip to nowMs
              let effectiveVal = val;
              let effectiveEnd = end;
              if (isToday && end > nowMs) {
                const totalDur = end - start;
                const elapsedDur = Math.max(0, nowMs - start);
                const fraction = totalDur > 0 ? (elapsedDur / totalDur) : 0;
                effectiveVal = val * fraction;
                effectiveEnd = nowMs;
              }
              intervalRecords.push({ ...s, start, end: effectiveEnd, val: effectiveVal });
            }
          }

          if (fullDayRecord) {
            projectedTotalCalories = Math.round(fullDayRecord.val);
          }

          // Compute non-overlapping interval sum
          let intervalTotal = 0;
          if (intervalRecords.length > 0) {
            intervalRecords.sort((a, b) => a.start !== b.start ? a.start - b.start : (b.end - b.start) - (a.end - a.start));
            let nonOverlappingSum = 0;
            let currentEnd = 0;

            for (const s of intervalRecords) {
              if (s.start >= currentEnd) {
                nonOverlappingSum += s.val;
                currentEnd = s.end;
              } else if (s.end > currentEnd) {
                const totalDur = s.end - s.start;
                const newDur = s.end - currentEnd;
                const fraction = totalDur > 0 ? (newDur / totalDur) : 0;
                nonOverlappingSum += s.val * fraction;
                currentEnd = s.end;
              }
            }
            intervalTotal = Math.round(nonOverlappingSum);
          }

          if (isToday) {
            if (intervalTotal > 0) {
              // Priority 1: Use true interval burn elapsed up to now (matches Google Fit intra-day progress)
              totalCalories = intervalTotal;
            } else if (fullDayRecord) {
              // Priority 2: Only 24h projected record exists (e.g. 2,232 kcal).
              // Prorate the resting portion by elapsed day fraction so unelapsed future hours are not counted!
              const totalSpanMs = Math.max(1, fullDayRecord.end - fullDayRecord.start);
              const elapsedSpanMs = Math.min(totalSpanMs, Math.max(0, nowMs - fullDayRecord.start));
              const dayFraction = elapsedSpanMs / totalSpanMs;
              const restingPart = Math.max(0, fullDayRecord.val - activeCalories);
              totalCalories = Math.round(activeCalories + (restingPart * dayFraction));
            } else if (sourceSamples.length > 0) {
              totalCalories = Math.round(Math.max(...sourceSamples.map(s => Number(s.value) || 0)));
            }
          } else {
            // Historical past date: full 24 hours completed
            const fullDayVal = fullDayRecord ? Math.round(fullDayRecord.val) : 0;
            totalCalories = Math.max(intervalTotal, fullDayVal);
            if (!projectedTotalCalories) projectedTotalCalories = totalCalories;
          }
        }
      }
    } catch (e) {
      console.warn('[HealthBridge] readSamples totalCalories notice:', e);
    }

    // Fallback: If readSamples returned 0, try queryAggregated
    if (totalCalories <= 0) {
      try {
        const aggRes = await withTimeout(
          Health.queryAggregated({
            dataType: 'totalCalories',
            startDate,
            endDate: queryEndDate,
            bucket: 'day',
            aggregation: 'sum'
          }),
          3000,
          null
        );
        if (aggRes?.samples && aggRes.samples.length > 0) {
          const val = Number(aggRes.samples[0]?.value) || 0;
          if (val > 0) {
            totalCalories = Math.round(val);
            queryMethodUsed = 'aggregated';
            rawTotalSamplesCount = aggRes.samples.length;
            rawTotalSamplesSum = val;
          }
        }
      } catch {
        // queryAggregated totalCalories not available
      }
    }

    // 3. Query Basal Metabolic Rate (BasalMetabolicRateRecord)
    // If wearable or Health Connect reports a basal rate in kcal/day, read the sample
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
        // Prioritize sample from Google Fit if available, otherwise most recent sample
        let chosenSample: any = null;
        for (const s of basalRes.samples) {
          const src = (s.sourceId || s.sourceName || '').toLowerCase();
          if (src.includes('fitness') || src.includes('google')) {
            chosenSample = s;
            break;
          }
        }
        if (!chosenSample) {
          chosenSample = basalRes.samples[basalRes.samples.length - 1];
        }
        const rate = Number(chosenSample?.value) || 0;
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
      projectedTotalCalories,
      basalCalories: basalCalories > 0 ? basalCalories : undefined,
      steps,
      source: 'health_connect',
      lastSyncedAt: new Date().toISOString(),
      diagnostics: {
        activeCount: activeSamplesCount,
        totalCount: rawTotalSamplesCount,
        totalSamplesSum: Math.round(rawTotalSamplesSum),
        sources: detectedSources,
        queryMethod: queryMethodUsed
      }
    };
  } catch (err) {
    console.error('[HealthBridge] syncHealthConnectDaily failed for ' + dateStr, err);
    return null;
  }
}
