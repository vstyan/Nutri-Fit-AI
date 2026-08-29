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
 * Queries both active calories expended (com.google.calories.expended) and
 * basal metabolic calories (com.google.calories.bmr) across the full 24-hour day window.
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

  const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: 'com.google.calories.expended' },
        { dataTypeName: 'com.google.calories.bmr' }
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis,
      endTimeMillis
    })
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Fit API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let expendedCalories = 0;
  let bmrCalories = 0;

  if (data.bucket && Array.isArray(data.bucket)) {
    for (const bucket of data.bucket) {
      if (bucket.dataset && Array.isArray(bucket.dataset)) {
        for (const dataset of bucket.dataset) {
          const isBmr = dataset.dataSourceId?.toLowerCase().includes('bmr');
          if (dataset.point && Array.isArray(dataset.point)) {
            for (const point of dataset.point) {
              if (point.value && Array.isArray(point.value)) {
                for (const val of point.value) {
                  const num = typeof val.fpVal === 'number' 
                    ? val.fpVal 
                    : (typeof val.intVal === 'number' ? val.intVal : 0);
                  if (isBmr) {
                    bmrCalories += num;
                  } else {
                    expendedCalories += num;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const totalCalories = expendedCalories + bmrCalories;
  console.log(`[Google Fit Sync ${dateStr}] Expended: ${expendedCalories.toFixed(1)} kcal, BMR: ${bmrCalories.toFixed(1)} kcal => Total: ${totalCalories.toFixed(1)} kcal`);

  return {
    totalCalories: Math.round(totalCalories),
    activeCalories: Math.round(expendedCalories),
    bmrCalories: Math.round(bmrCalories),
    lastSyncedAt: new Date().toISOString()
  };
}
