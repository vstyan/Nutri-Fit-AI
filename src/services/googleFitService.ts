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
 * Queries the platform merged stream (derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended)
 * across the full 24-hour day window to match the exact daily total computed by Google Fit.
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

  const parseCaloriesFromResponse = async (response: Response): Promise<number> => {
    const data = await response.json();
    let total = 0;

    if (data.bucket && Array.isArray(data.bucket)) {
      for (const bucket of data.bucket) {
        if (bucket.dataset && Array.isArray(bucket.dataset)) {
          for (const dataset of bucket.dataset) {
            if (dataset.point && Array.isArray(dataset.point)) {
              for (const point of dataset.point) {
                if (point.value && Array.isArray(point.value)) {
                  for (const val of point.value) {
                    const num = typeof val.fpVal === 'number' 
                      ? val.fpVal 
                      : (typeof val.intVal === 'number' ? val.intVal : 0);
                    total += num;
                  }
                }
              }
            }
          }
        }
      }
    }
    return total;
  };

  // 1. Primary: query platform merged calories stream (combines BMR + activity calories)
  let totalCalories = 0;
  const mergedResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
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

  if (mergedResponse.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (mergedResponse.ok) {
    totalCalories = await parseCaloriesFromResponse(mergedResponse);
  }

  // 2. Fallback: if merged stream failed or returned 0, query generic dataTypeName
  if (totalCalories <= 0) {
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
      totalCalories = await parseCaloriesFromResponse(fallbackResponse);
    } else if (!mergedResponse.ok) {
      const errorText = await mergedResponse.text();
      throw new Error(`Google Fit API error (${mergedResponse.status}): ${errorText}`);
    }
  }

  console.log(`[Google Fit Sync ${dateStr}] Total Calories Expended: ${totalCalories.toFixed(1)} kcal`);

  return {
    totalCalories: Math.round(totalCalories),
    activeCalories: Math.round(totalCalories),
    bmrCalories: 0,
    lastSyncedAt: new Date().toISOString()
  };
}
