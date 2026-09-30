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
  caloriesBurned?: number;
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
 * Fetches recorded workout sessions for a given time window from Google Fit Sessions API,
 * and queries Google Fit's aggregate dataset with bucketBySession to extract exact calories burned per session.
 */
export async function fetchGoogleFitSessions(
  startTimeMillis: number,
  endTimeMillis: number,
  accessToken: string
): Promise<GoogleFitSession[]> {
  const sessionsMap = new Map<string, GoogleFitSession>();

  // 1. Fetch raw recorded sessions from Google Fit sessions endpoint
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
    if (response.ok) {
      const data = await response.json();
      if (data.session && Array.isArray(data.session)) {
        for (const s of data.session) {
          const sId = s.id || `session-${s.startTimeMillis}`;
          sessionsMap.set(sId, {
            id: sId,
            name: s.name || '',
            description: s.description || '',
            startTimeMillis: Number(s.startTimeMillis),
            endTimeMillis: Number(s.endTimeMillis),
            activityType: Number(s.activityType) || 108
          });
        }
      }
    }
  } catch (err) {
    console.warn('Google Fit sessions lookup notice:', err);
  }

  // 2. Query aggregate dataset with bucketBySession to fetch exact calories per session directly from Google Fit
  try {
    const aggResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.calories.expended' }
        ],
        bucketBySession: { minDurationMillis: 0 },
        startTimeMillis,
        endTimeMillis
      })
    });

    if (aggResponse.ok) {
      const aggData = await aggResponse.json();
      if (aggData.bucket && Array.isArray(aggData.bucket)) {
        for (const b of aggData.bucket) {
          const sess = b.session;
          if (!sess) continue;

          let sessionCalories = 0;
          if (b.dataset && Array.isArray(b.dataset)) {
            for (const ds of b.dataset) {
              if (ds.point && Array.isArray(ds.point)) {
                for (const pt of ds.point) {
                  if (pt.value && Array.isArray(pt.value)) {
                    for (const v of pt.value) {
                      const num = typeof v.fpVal === 'number' ? v.fpVal : (typeof v.intVal === 'number' ? v.intVal : 0);
                      sessionCalories += num;
                    }
                  }
                }
              }
            }
          }

          const sId = sess.id || `session-${sess.startTimeMillis || b.startTimeMillis}`;
          const existing = sessionsMap.get(sId);
          if (existing) {
            if (sessionCalories > 0) {
              existing.caloriesBurned = Math.round(sessionCalories);
            }
          } else {
            sessionsMap.set(sId, {
              id: sId,
              name: sess.name || '',
              description: sess.description || '',
              startTimeMillis: Number(sess.startTimeMillis || b.startTimeMillis),
              endTimeMillis: Number(sess.endTimeMillis || b.endTimeMillis),
              activityType: Number(sess.activityType) || 108,
              caloriesBurned: sessionCalories > 0 ? Math.round(sessionCalories) : undefined
            });
          }
        }
      }
    }
  } catch (aggErr) {
    console.warn('Google Fit session calories aggregate notice:', aggErr);
  }

  return Array.from(sessionsMap.values());
}

/**
 * Detects workout sessions and significant calorie burn surges from Google Fit data.
 * - Recognizes explicit tracked Google Fit sessions (from smartwatches/Fitbit/Wear OS/apps).
 * - Accurately divides calories among multiple sessions within the same hour bucket without double/triple counting.
 * - Enforces physiological sanity caps to prevent unrealistic multi-hour active burn inflation.
 * - Detects large jumps in burned calories in remaining uncovered time windows.
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

  // Filter valid exercise sessions (ignore sleep activityType 72, and negligible sessions < 5 min)
  const validSessions = sessions.filter(session => {
    if (session.activityType === 72) return false;
    const durationMinutes = Math.max(1, Math.round((session.endTimeMillis - session.startTimeMillis) / 60000));
    return durationMinutes >= 5;
  });

  // Pre-calculate total workout overlap (in ms) per hourly bucket to prevent double/triple counting across multiple sessions
  const bucketWorkoutOverlapMap = new Map<number, number>();
  for (const session of validSessions) {
    for (const b of hourlyBuckets) {
      const overlapStart = Math.max(session.startTimeMillis, b.startMillis);
      const overlapEnd = Math.min(session.endTimeMillis, b.endMillis);
      if (overlapEnd > overlapStart) {
        const overlapMs = overlapEnd - overlapStart;
        bucketWorkoutOverlapMap.set(b.hour, (bucketWorkoutOverlapMap.get(b.hour) || 0) + overlapMs);
      }
    }
  }

  // 1. Process explicit Google Fit Sessions with non-overlapping proportional allocation
  for (const session of validSessions) {
    const durationMinutes = Math.max(1, Math.round((session.endTimeMillis - session.startTimeMillis) / 60000));

    let sessionActiveKcal = 0;

    // A) If Google Fit's bucketBySession returned exact calories for this session, use it!
    if (session.caloriesBurned && session.caloriesBurned > 0) {
      sessionActiveKcal = session.caloriesBurned;
      for (const b of hourlyBuckets) {
        if (b.endMillis > session.startTimeMillis && b.startMillis < session.endTimeMillis) {
          coveredBucketHours.add(b.hour);
        }
      }
    } else {
      // B) Proportional time-slice allocation across overlapping hours without multi-session duplication
      for (const b of hourlyBuckets) {
        const overlapStart = Math.max(session.startTimeMillis, b.startMillis);
        const overlapEnd = Math.min(session.endTimeMillis, b.endMillis);
        if (overlapEnd > overlapStart) {
          coveredBucketHours.add(b.hour);
          const overlapMs = overlapEnd - overlapStart;
          const totalWorkoutMsInHour = bucketWorkoutOverlapMap.get(b.hour) || (60 * 60 * 1000);
          const bActive = b.activeCalories > 0 ? b.activeCalories : Math.max(0, b.totalCalories - avgHourlyBmr);

          // Proportional share: session gets its exact slice of the hour's active calories
          const share = bActive * (overlapMs / Math.max(overlapMs, totalWorkoutMsInHour));
          sessionActiveKcal += share;
        }
      }
    }

    // Physiological sanity capping: no human burns > 14 kcal/min in routine workouts
    const maxPhysiologicalKcal = Math.round(durationMinutes * 14);
    if (sessionActiveKcal > maxPhysiologicalKcal) {
      sessionActiveKcal = maxPhysiologicalKcal;
    }

    // Fallback if session active kcal is still 0
    if (sessionActiveKcal <= 0) {
      sessionActiveKcal = Math.round(durationMinutes * 5);
    }

    const rawActivityName = session.name || GOOGLE_FIT_ACTIVITY_MAP[session.activityType] || 'Workout Session';

    detectedWorkouts.push({
      id: `gfit-session-${session.id || session.startTimeMillis}`,
      timestamp: new Date(session.startTimeMillis).toISOString(),
      title: `${rawActivityName} (Google Fit)`,
      description: `Tracked workout session synced from Google Fit (${rawActivityName}, ${Math.round(sessionActiveKcal)} kcal, ${durationMinutes} min).`,
      caloriesBurned: Math.round(sessionActiveKcal),
      durationMinutes,
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

      detectedWorkouts.push({
        id: `gfit-jump-${dateStr}-${startHour}`,
        timestamp: new Date(b.startMillis).toISOString(),
        title: `Workout Surge (${timeRangeLabel})`,
        description: `Calorie burn spike detected by Google Fit (${Math.round(combinedActive)} active kcal burned between ${timeRangeLabel}).`,
        caloriesBurned: Math.round(combinedActive),
        durationMinutes,
        explanation: `Identified by high-intensity energy expenditure surge exceeding resting baseline.`
      });
    }

    i++;
  }

  return detectedWorkouts;
}

/**
 * Fetches total calories burned for a specific calendar date from Google Fit.
 * Queries:
 * 1. The official 24-hour total burn from Google Fit's merge_calories_expended stream
 *    (matching the exact daily total displayed on Google Fit's home screen, e.g. 2,003 Cal).
 * 2. 1-hour resolution buckets for active movement (from_activities) to detect workout surges.
 * 3. Recorded workout sessions from Google Fit Sessions API.
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

  // 1. Fetch official 24-hour total burn from Google Fit's merge_calories_expended stream
  let dailyTotal = 0;
  try {
    const dailyResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
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
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis
      })
    });

    if (dailyResponse.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (dailyResponse.ok) {
      const dailyData = await dailyResponse.json();
      if (dailyData.bucket && Array.isArray(dailyData.bucket)) {
        for (const bucket of dailyData.bucket) {
          if (bucket.dataset && Array.isArray(bucket.dataset)) {
            for (const dataset of bucket.dataset) {
              if (dataset.point && Array.isArray(dataset.point)) {
                for (const point of dataset.point) {
                  if (point.value && Array.isArray(point.value)) {
                    for (const val of point.value) {
                      const num = typeof val.fpVal === 'number' ? val.fpVal : (typeof val.intVal === 'number' ? val.intVal : 0);
                      dailyTotal += num;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') throw err;
    console.warn('Google Fit daily merge query error:', err);
  }

  // Fallback for daily total if merge_calories_expended returned 0
  if (dailyTotal <= 0) {
    try {
      const fallbackResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis
        })
      });
      if (fallbackResponse.status === 401) throw new Error('UNAUTHORIZED');
      if (fallbackResponse.ok) {
        const fbData = await fallbackResponse.json();
        if (fbData.bucket && Array.isArray(fbData.bucket)) {
          for (const bucket of fbData.bucket) {
            if (bucket.dataset && Array.isArray(bucket.dataset)) {
              for (const dataset of bucket.dataset) {
                if (dataset.point && Array.isArray(dataset.point)) {
                  for (const point of dataset.point) {
                    if (point.value && Array.isArray(point.value)) {
                      for (const val of point.value) {
                        const num = typeof val.fpVal === 'number' ? val.fpVal : (typeof val.intVal === 'number' ? val.intVal : 0);
                        dailyTotal += num;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (fbErr: any) {
      if (fbErr.message === 'UNAUTHORIZED') throw fbErr;
      console.warn('Google Fit fallback daily query error:', fbErr);
    }
  }

  // 2. Fetch 1-hour resolution buckets for active burn (from_activities) and hourly surge detection
  let totalActive = 0;
  const hourlyBuckets: HourlyCalorieBucket[] = [];
  try {
    const hourlyResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
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
          }
        ],
        bucketByTime: { durationMillis: 3600000 },
        startTimeMillis,
        endTimeMillis
      })
    });

    if (hourlyResponse.status === 401) {
      throw new Error('UNAUTHORIZED');
    }

    if (hourlyResponse.ok) {
      const hData = await hourlyResponse.json();
      if (hData.bucket && Array.isArray(hData.bucket)) {
        for (const bucket of hData.bucket) {
          const startMillis = Number(bucket.startTimeMillis) || 0;
          const endMillis = Number(bucket.endTimeMillis) || 0;
          const bucketDate = new Date(startMillis);
          const hour = bucketDate.getHours();
          const startStr = bucketDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          const endStr = new Date(endMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

          let bActive = 0;
          if (bucket.dataset && Array.isArray(bucket.dataset)) {
            for (const dataset of bucket.dataset) {
              if (dataset.point && Array.isArray(dataset.point)) {
                for (const point of dataset.point) {
                  if (point.value && Array.isArray(point.value)) {
                    for (const val of point.value) {
                      const num = typeof val.fpVal === 'number' ? val.fpVal : (typeof val.intVal === 'number' ? val.intVal : 0);
                      bActive += num;
                    }
                  }
                }
              }
            }
          }

          totalActive += bActive;
          hourlyBuckets.push({
            hour,
            startTime: startStr,
            endTime: endStr,
            startMillis,
            endMillis,
            activeCalories: bActive,
            bmrCalories: 0,
            totalCalories: bActive
          });
        }
      }
    }
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') throw err;
    console.warn('Google Fit hourly from_activities query error:', err);
  }

  // 3. Fetch Google Fit Sessions to cross-reference and detect workouts
  const sessions = await fetchGoogleFitSessions(startTimeMillis, endTimeMillis, accessToken);

  // 4. Run workout jump detection
  const effectiveBmr = userProfileBmr && userProfileBmr > 0 ? userProfileBmr : Math.max(0, dailyTotal - totalActive);
  const detectedWorkouts = detectWorkoutsFromFitData(hourlyBuckets, sessions, dateStr, effectiveBmr);

  // If dailyTotal was somehow 0, fall back to totalActive
  const finalTotal = dailyTotal > 0 ? dailyTotal : totalActive;

  console.log(`[Google Fit Sync ${dateStr}] Google Fit Official Total: ${finalTotal.toFixed(1)} kcal, Active Steps/Exercise: ${totalActive.toFixed(1)} kcal, Detected Workouts: ${detectedWorkouts.length}`);

  return {
    totalCalories: Math.round(finalTotal),
    activeCalories: Math.round(totalActive),
    bmrCalories: Math.round(Math.max(0, finalTotal - totalActive)),
    lastSyncedAt: new Date().toISOString(),
    hourlyBuckets,
    detectedWorkouts
  };
}
