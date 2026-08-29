/**
 * Google Fit REST API service for automatic calorie burn synchronization.
 */
import { getLocalDateString } from '../utils/dateUtils';

export const DEFAULT_GOOGLE_CLIENT_ID = '657464757102-eqfql87cgmlkngfd4hdlo6vt33o0q865.apps.googleusercontent.com';

const FITNESS_SCOPES = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read';

export interface GoogleFitCaloriesResult {
  totalCalories: number;
  activeCalories: number;
  bmrCalories: number;
  lastSyncedAt: string;
}

/**
 * Requests OAuth 2.0 access token for Google Fit via Google Identity Services.
 */
export async function requestGoogleFitAccessToken(
  clientId: string = DEFAULT_GOOGLE_CLIENT_ID
): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services library is not loaded. Please check your internet connection.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId || DEFAULT_GOOGLE_CLIENT_ID,
        scope: FITNESS_SCOPES,
        callback: (response: any) => {
          if (response.error) {
            console.error('Google Fit OAuth response error:', response);
            reject(new Error(response.error_description || response.error));
            return;
          }
          const expiresIn = Number(response.expires_in) || 3600;
          resolve({
            accessToken: response.access_token,
            expiresIn
          });
        },
        error_callback: (err: any) => {
          console.warn('Google Fit token error callback:', err);
          reject(new Error(err?.message || 'Google authorization was closed or denied.'));
        }
      });

      client.requestAccessToken({ prompt: '' });
    } catch (err: any) {
      reject(new Error(err.message || 'Failed to initialize Google login.'));
    }
  });
}

/**
 * Fetches total calories burned for a specific calendar date from Google Fit.
 * Queries both active calories (derived:com.google.calories.expended:com.google.android.gms:from_activities)
 * and resting BMR calories (derived:com.google.calories.expended:com.google.android.gms:from_bmr)
 * across the full 24-hour day window to calculate the true daily total (BMR + Active).
 */
export async function fetchGoogleFitCalories(
  dateStr: string,
  accessToken: string
): Promise<GoogleFitCaloriesResult> {
  const parts = dateStr.split('-').map(Number);
  const startOfDay = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);

  // Use full 24-hour window (86,400,000 ms) so Google Fit's 24h bucket aggregates all samples recorded today
  const startTimeMillis = startOfDay.getTime();
  const endTimeMillis = startTimeMillis + 86400000; // Exact midnight at end of day

  const parseResponse = async (response: Response): Promise<{ active: number; bmr: number; total: number }> => {
    const data = await response.json();
    let active = 0;
    let bmr = 0;
    let merged = 0;
    let other = 0;

    if (data.bucket && Array.isArray(data.bucket)) {
      for (const bucket of data.bucket) {
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
              merged += sum;
            } else if (dsId.includes('from_activities')) {
              active += sum;
            } else if (dsId.includes('from_bmr') || dsId.includes('bmr')) {
              bmr += sum;
            } else {
              other += sum;
            }
          }
        }
      }
    }

    const calculatedTotal = merged > 0 
      ? merged 
      : (active + bmr > 0 ? (active + bmr) : other);

    return {
      active,
      bmr,
      total: calculatedTotal
    };
  };

  // Attempt 1: Query both from_activities and from_bmr to get the combined total
  let result = { active: 0, bmr: 0, total: 0 };

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
      bucketByTime: { durationMillis: 86400000 },
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

  // Attempt 2: If primary was empty, try merge_calories_expended
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
        bucketByTime: { durationMillis: 86400000 },
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

  // Attempt 3: Generic fallback
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

  console.log(`[Google Fit Sync ${dateStr}] Active: ${result.active.toFixed(1)} kcal, BMR: ${result.bmr.toFixed(1)} kcal => Total: ${result.total.toFixed(1)} kcal`);

  return {
    totalCalories: Math.round(result.total),
    activeCalories: Math.round(result.active > 0 ? result.active : result.total),
    bmrCalories: Math.round(result.bmr),
    lastSyncedAt: new Date().toISOString()
  };
}
