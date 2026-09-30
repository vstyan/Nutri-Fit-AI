/**
 * Google Fit REST API service for automatic calorie burn synchronization.
 */
import { getLocalDateString } from '../utils/dateUtils';
import { WorkoutEntry } from '../types';

export const DEFAULT_GOOGLE_CLIENT_ID = '657464757102-eqfql87cgmlkngfd4hdlo6vt33o0q865.apps.googleusercontent.com';

const FITNESS_SCOPES = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read';

export interface HourlyCalorieBucket {
  hour: number; // 0 to 23
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  startMillis: number;
  endMillis: number;
  activeCalories: number;
  bmrCalories: number;
  totalCalories: number;
}

export interface GoogleFitSession {
  id: string;
  name: string;
  description?: string;
  startTimeMillis: number;
  endTimeMillis: number;
  activityType: number;
}

export interface GoogleFitCaloriesResult {
  totalCalories: number;
  activeCalories: number;
  bmrCalories: number;
  lastSyncedAt: string;
  hourlyBuckets?: HourlyCalorieBucket[];
  detectedWorkouts?: WorkoutEntry[];
}

/**
 * Requests OAuth 2.0 access token for Google Fit via Google Identity Services.
 * Uses login_hint to prevent "Choose an account" dialogs if multiple Google accounts exist.
 */
export async function requestGoogleFitAccessToken(
  clientId: string = DEFAULT_GOOGLE_CLIENT_ID,
  userEmailHint?: string,
  promptOption: string = ''
): Promise<{ accessToken: string; expiresIn: number; email?: string }> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library is not loaded. Please check your internet connection.'));
      return;
    }

    try {
      const config: any = {
        client_id: clientId || DEFAULT_GOOGLE_CLIENT_ID,
        scope: FITNESS_SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            console.error('Google Fit OAuth response error:', response);
            reject(new Error(response.error_description || response.error));
            return;
          }
          const expiresIn = Number(response.expires_in) || 3600;
          let email = userEmailHint;
          if (!email && response.access_token) {
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              });
              if (userInfoRes.ok) {
                const info = await userInfoRes.json();
                email = info.email;
              }
            } catch (e) {
              console.warn('Could not fetch user email:', e);
            }
          }
          resolve({
            accessToken: response.access_token,
            expiresIn,
            email
          });
        },
        error_callback: (err: any) => {
          console.warn('Google Fit token error callback:', err);
          reject(new Error(err?.message || 'Google authorization was closed or denied.'));
        }
      };

      if (userEmailHint) {
        config.hint = userEmailHint;
      }

      const client = google.accounts.oauth2.initTokenClient(config);

      const requestOptions: any = {};
      if (promptOption !== undefined && promptOption !== '') {
        requestOptions.prompt = promptOption;
      } else {
        requestOptions.prompt = '';
      }
      if (userEmailHint) {
        requestOptions.hint = userEmailHint;
      }

      client.requestAccessToken(requestOptions);
    } catch (err: any) {
      reject(new Error(err.message || 'Failed to initialize Google login.'));
    }
  });
}

export const GOOGLE_FIT_ACTIVITY_MAP: Record<number, string> = {
  1: 'Biking / Cycling',
  7: 'Brisk Walking',
  8: 'Running',
  9: 'Aerobics',
  10: 'Badminton',
  11: 'Baseball',
  12: 'Basketball',
  14: 'Handbiking',
  15: 'Mountain Biking',
  16: 'Road Biking',
  17: 'Spinning',
  18: 'Stationary Biking',
  20: 'Boxing',
  21: 'Calisthenics',
  22: 'Circuit Training',
  24: 'Dancing',
  25: 'Elliptical',
  26: 'Fencing',
  27: 'Football',
  29: 'Soccer',
  35: 'Hiking',
  40: 'Jumping Rope',
  42: 'Kettlebell Training',
  43: 'Kickboxing',
  45: 'Martial Arts',
  50: 'Pilates',
  54: 'Rowing',
  55: 'Rowing Machine',
  57: 'Jogging',
  58: 'Sand Running',
  59: 'Treadmill Running',
  70: 'Snowboarding',
  74: 'Stair Climbing',
  75: 'Stair-Climbing Machine',
  77: 'Strength Training',
  80: 'Swimming',
  84: 'Tennis',
  86: 'Volleyball',
  88: 'Weightlifting',
  97: 'Weightlifting',
  100: 'Yoga',
  108: 'Workout Session',
  113: 'Crossfit',
  114: 'HIIT (High-Intensity Interval Training)',
  115: 'Interval Training'
};

/**
 * Fetches recorded workout sessions for a given time window from Google Fit Sessions API.
 */
export async function fetchGoogleFitSessions(
  startTimeMillis: number,
  endTimeMillis: number,
  accessToken: string
): Promise<GoogleFitSession[]> {
  try {
    const isoStart = new Date(startTimeMillis).toISOString();
    const isoEnd = new Date(endTimeMillis).toISOString();
    const response = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${isoStart}&endTime=${isoEnd}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (data.session && Array.isArray(data.session)) {
      return data.session.map((s: any) => ({
        id: s.id || `session-${s.startTimeMillis}`,
        name: s.name || '',
        description: s.description || '',
        startTimeMillis: Number(s.startTimeMillis),
        endTimeMillis: Number(s.endTimeMillis),
        activityType: Number(s.activityType) || 108
      }));
    }
  } catch (err) {
    console.warn('Google Fit sessions lookup notice:', err);
  }
  return [];
}

/**
 * Detects workout sessions and significant calorie burn surges from Google Fit data.
 * - Recognizes explicit tracked Google Fit sessions (from smartwatches/Fitbit/Wear OS/apps).
 * - Detects large jumps in burned calories in specific time windows (e.g. >= 150 active kcal/hr).
 */
export function detectWorkoutsFromFitData(
  hourlyBuckets: HourlyCalorieBucket[],
  sessions: GoogleFitSession[],
  dateStr: string,
  totalBmr: number = 0
): WorkoutEntry[] {
  const detectedWorkouts: WorkoutEntry[] = [];
  const coveredBucketHours = new Set<number>();

  const avgHourlyBmr = totalBmr > 0 ? (totalBmr / 24) : 70;

  // 1. Process explicit Google Fit Sessions first (e.g. from smartwatch/wearable/app)
  for (const session of sessions) {
    // Ignore sleep sessions (activityType 72) or negligible sessions (< 5 min)
    if (session.activityType === 72) continue;
    const durationMinutes = Math.max(1, Math.round((session.endTimeMillis - session.startTimeMillis) / (60 * 1000)));
    if (durationMinutes < 5) continue;

    // Find overlapping hourly buckets to sum active calories
    let sessionActiveKcal = 0;
    for (const b of hourlyBuckets) {
      if (b.endMillis > session.startTimeMillis && b.startMillis < session.endTimeMillis) {
        coveredBucketHours.add(b.hour);
        const bActive = b.activeCalories > 0 ? b.activeCalories : Math.max(0, b.totalCalories - avgHourlyBmr);
        sessionActiveKcal += bActive;
      }
    }

    if (sessionActiveKcal <= 0) {
      sessionActiveKcal = Math.round(durationMinutes * 6);
    }

    const rawActivityName = session.name || GOOGLE_FIT_ACTIVITY_MAP[session.activityType] || 'Workout Session';
    const calPerMin = sessionActiveKcal / durationMinutes;
    const intensity = calPerMin >= 8 ? 'vigorous' : (calPerMin >= 5 ? 'high' : (calPerMin >= 3 ? 'moderate' : 'low'));

    detectedWorkouts.push({
      id: `gfit-session-${session.id || session.startTimeMillis}`,
      timestamp: new Date(session.startTimeMillis).toISOString(),
      title: `${rawActivityName} (Google Fit)`,
      description: `Tracked workout session synced from Google Fit (${rawActivityName}, ${Math.round(sessionActiveKcal)} kcal, ${durationMinutes} min).`,
      caloriesBurned: Math.round(sessionActiveKcal),
      durationMinutes,
      intensity,
      explanation: `Google Fit tracked session with ${Math.round(sessionActiveKcal)} active calories burned.`
    });
  }

  // 2. Detect large calorie burn surges / jumps in remaining uncovered hours
  const sorted = [...hourlyBuckets].sort((a, b) => a.hour - b.hour);
  let i = 0;

  while (i < sorted.length) {
    const b = sorted[i];
    if (coveredBucketHours.has(b.hour)) {
      i++;
      continue;
    }

    const activeKcal = b.activeCalories > 0 ? b.activeCalories : Math.max(0, b.totalCalories - avgHourlyBmr);

    // Threshold for workout surge: >= 150 active kcal in a 1-hour window (or total burn >= baseline + 150 kcal)
    if (activeKcal >= 150 || b.totalCalories >= avgHourlyBmr + 150) {
      let combinedActive = activeKcal;
      const startHour = b.hour;
      let endHour = b.hour + 1;
      let durationMinutes = 60;
      coveredBucketHours.add(b.hour);

      // Check if the next hour was also elevated (e.g. workout spanning 10:30 - 12:00)
      if (i + 1 < sorted.length) {
        const nextB = sorted[i + 1];
        if (!coveredBucketHours.has(nextB.hour)) {
          const nextActive = nextB.activeCalories > 0 ? nextB.activeCalories : Math.max(0, nextB.totalCalories - avgHourlyBmr);
          if (nextActive >= 100) {
            combinedActive += nextActive;
            endHour = nextB.hour + 1;
            durationMinutes += 60;
            coveredBucketHours.add(nextB.hour);
            i++;
          }
        }
      }

      const formatDisplayHour = (h: number) => {
        const period = h >= 12 && h < 24 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH}:00 ${period}`;
      };

      const timeRangeLabel = `${formatDisplayHour(startHour)} - ${formatDisplayHour(endHour)}`;
      const calPerMin = combinedActive / durationMinutes;
      const intensity = calPerMin >= 7 ? 'vigorous' : (calPerMin >= 4.5 ? 'high' : 'moderate');

      detectedWorkouts.push({
        id: `gfit-jump-${dateStr}-${startHour}`,
        timestamp: new Date(b.startMillis).toISOString(),
        title: `Workout Surge (${timeRangeLabel})`,
        description: `Calorie burn spike detected by Google Fit (${Math.round(combinedActive)} active kcal burned between ${timeRangeLabel}).`,
        caloriesBurned: Math.round(combinedActive),
        durationMinutes,
        intensity,
        explanation: `Identified by high-intensity energy expenditure surge exceeding resting baseline.`
      });
    }

    i++;
  }

  return detectedWorkouts;
}

/**
 * Fetches total calories burned for a specific calendar date from Google Fit.
 * Queries both active calories and resting BMR calories using hourly buckets
 * (3,600,000 ms), detects workout sessions and large calorie burn surges,
 * and calculates the true daily total (BMR + Active).
 */
export async function fetchGoogleFitCalories(
  dateStr: string,
  accessToken: string,
  userProfileBmr?: number
): Promise<GoogleFitCaloriesResult> {
  const parts = dateStr.split('-').map(Number);
  const startOfDay = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);

  // Use full 24-hour window (86,400,000 ms)
  const startTimeMillis = startOfDay.getTime();
  const endTimeMillis = startTimeMillis + 86400000; // Exact midnight at end of day

  const parseResponse = async (response: Response): Promise<{
    active: number;
    bmr: number;
    total: number;
    hourlyBuckets: HourlyCalorieBucket[];
  }> => {
    const data = await response.json();
    let totalActive = 0;
    let totalBmr = 0;
    let totalMerged = 0;
    let totalOther = 0;
    const hourlyBuckets: HourlyCalorieBucket[] = [];

    if (data.bucket && Array.isArray(data.bucket)) {
      for (const bucket of data.bucket) {
        const startMillis = Number(bucket.startTimeMillis) || 0;
        const endMillis = Number(bucket.endTimeMillis) || 0;
        const bucketDate = new Date(startMillis);
        const hour = bucketDate.getHours();
        const startStr = bucketDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const endStr = new Date(endMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        let bActive = 0;
        let bBmr = 0;
        let bMerged = 0;
        let bOther = 0;

        if (bucket.dataset && Array.isArray(bucket.dataset)) {
          for (const dataset of bucket.dataset) {
            const dsId = (dataset.dataSourceId || '').toLowerCase();
            let sum = 0;
            if (dataset.point && Array.isArray(dataset.point)) {
              for (const point of dataset.point) {
                if (point.value && Array.isArray(point.value)) {
                  for (const val of point.value) {
                    const num = typeof val.fpVal === 'number' 
                      ? val.fpVal 
                      : (typeof val.intVal === 'number' ? val.intVal : 0);
                    sum += num;
                  }
                }
              }
            }
            if (dsId.includes('merge_calories_expended')) {
              bMerged += sum;
            } else if (dsId.includes('from_activities')) {
              bActive += sum;
            } else if (dsId.includes('from_bmr') || dsId.includes('bmr')) {
              bBmr += sum;
            } else {
              bOther += sum;
            }
          }
        }

        const bTotal = bMerged > 0 ? bMerged : (bActive + bBmr > 0 ? (bActive + bBmr) : bOther);

        totalMerged += bMerged;
        totalActive += bActive;
        totalBmr += bBmr;
        totalOther += bOther;

        hourlyBuckets.push({
          hour,
          startTime: startStr,
          endTime: endStr,
          startMillis,
          endMillis,
          activeCalories: bActive,
          bmrCalories: bBmr,
          totalCalories: bTotal
        });
      }
    }

    const calculatedTotal = totalMerged > 0 
      ? totalMerged 
      : (totalActive + totalBmr > 0 ? (totalActive + totalBmr) : totalOther);

    return {
      active: totalActive,
      bmr: totalBmr,
      total: calculatedTotal,
      hourlyBuckets
    };
  };

  // Attempt 1: Query both from_activities and from_bmr with 1-hour buckets
  let result = { active: 0, bmr: 0, total: 0, hourlyBuckets: [] as HourlyCalorieBucket[] };

  const primaryResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [
        {
          dataTypeName: 'com.google.calories.expended',
          dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:from_activities'
        },
        {
          dataTypeName: 'com.google.calories.expended',
          dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:from_bmr'
        }
      ],
      bucketByTime: { durationMillis: 3600000 },
      startTimeMillis,
      endTimeMillis
    })
  });

  if (primaryResponse.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (primaryResponse.ok) {
    result = await parseResponse(primaryResponse);
  }

  // Attempt 2: If primary was empty, try merge_calories_expended with 1-hour buckets
  if (result.total <= 0) {
    const mergeResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [
          {
            dataTypeName: 'com.google.calories.expended',
            dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
          }
        ],
        bucketByTime: { durationMillis: 3600000 },
        startTimeMillis,
        endTimeMillis
      })
    });

    if (mergeResponse.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (mergeResponse.ok) {
      result = await parseResponse(mergeResponse);
    }
  }

  // Attempt 3: 24h whole-day aggregate fallback if hourly returns no data
  if (result.total <= 0) {
    const fallbackResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.calories.expended' }
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis
      })
    });

    if (fallbackResponse.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (fallbackResponse.ok) {
      result = await parseResponse(fallbackResponse);
    } else if (!primaryResponse.ok) {
      const errorText = await primaryResponse.text();
      throw new Error(`Google Fit API error (${primaryResponse.status}): ${errorText}`);
    }
  }

  // Fetch Google Fit Sessions to cross-reference and detect workouts
  const sessions = await fetchGoogleFitSessions(startTimeMillis, endTimeMillis, accessToken);

  // Run workout jump detection on hourly buckets and recorded sessions
  const effectiveBmr = userProfileBmr && userProfileBmr > 0 ? userProfileBmr : result.bmr;
  const detectedWorkouts = detectWorkoutsFromFitData(result.hourlyBuckets, sessions, dateStr, effectiveBmr);

  console.log(`[Google Fit Sync ${dateStr}] Active: ${result.active.toFixed(1)} kcal, BMR: ${result.bmr.toFixed(1)} kcal => Total: ${result.total.toFixed(1)} kcal. Detected workouts: ${detectedWorkouts.length}`);

  const activeExpended = result.active > 0 ? result.active : (result.total > effectiveBmr ? result.total - effectiveBmr : 0);

  return {
    totalCalories: Math.round(result.total),
    activeCalories: Math.round(activeExpended),
    bmrCalories: Math.round(result.bmr),
    lastSyncedAt: new Date().toISOString(),
    hourlyBuckets: result.hourlyBuckets,
    detectedWorkouts
  };
}
