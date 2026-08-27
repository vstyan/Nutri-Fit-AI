import { get, set } from 'idb-keyval';
import { AppSettings, MealRecord, DailyActivity } from '../types';
import { saveJsonToDrive, readJsonFromDrive } from './googleDriveService';

const SETTINGS_KEY = 'nutrifit_settings_v3';
const MEALS_PREFIX = 'nutrifit_meals_';
const ACTIVITY_PREFIX = 'nutrifit_activity_';

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  storageLocation: 'local_indexeddb',
  storagePromptDismissed: false,
  goals: {
    dailyCaloriesTarget: 2000,
    dailyCarbsTarget: 200,
    dailyProteinTarget: 140,
    dailyFatTarget: 65,
  }
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const saved = await get<AppSettings>(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...saved, goals: { ...DEFAULT_SETTINGS.goals, ...saved.goals } };
    }
  } catch (e) {
    console.error('Error loading settings from IndexedDB:', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await set(SETTINGS_KEY, settings);
  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive('app-settings.json', settings, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync settings to Google Drive:', e);
    }
  }
}

export async function getMealsForDate(date: string, settings: AppSettings): Promise<MealRecord[]> {
  const localKey = `${MEALS_PREFIX}${date}`;
  let localMeals: MealRecord[] = [];

  try {
    localMeals = (await get<MealRecord[]>(localKey)) || [];
  } catch (e) {
    console.error('Error fetching meals from IndexedDB:', e);
  }

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      const driveMeals = await readJsonFromDrive<MealRecord[]>(`meals-${date}.json`, settings.googleAccessToken);
      if (driveMeals && driveMeals.length > 0) {
        const combined = [...driveMeals];
        for (const lm of localMeals) {
          if (!combined.some(m => m.id === lm.id)) {
            combined.push(lm);
          }
        }
        await set(localKey, combined);
        return combined;
      }
    } catch (e) {
      console.warn('Error reading meals from Google Drive:', e);
    }
  }

  return localMeals;
}

export async function saveMeal(meal: MealRecord, settings: AppSettings): Promise<void> {
  const localKey = `${MEALS_PREFIX}${meal.date}`;
  const existing = (await get<MealRecord[]>(localKey)) || [];
  const updated = existing.filter(m => m.id !== meal.id).concat(meal);

  await set(localKey, updated);

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive(`meals-${meal.date}.json`, updated, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync meal to Google Drive:', e);
    }
  }
}

export async function deleteMeal(mealId: string, date: string, settings: AppSettings): Promise<void> {
  const localKey = `${MEALS_PREFIX}${date}`;
  const existing = (await get<MealRecord[]>(localKey)) || [];
  const updated = existing.filter(m => m.id !== mealId);

  await set(localKey, updated);

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive(`meals-${date}.json`, updated, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync meal deletion to Google Drive:', e);
    }
  }
}

export async function getActivityForDate(date: string): Promise<DailyActivity> {
  const localKey = `${ACTIVITY_PREFIX}${date}`;
  try {
    const saved = await get<DailyActivity>(localKey);
    if (saved) return saved;
  } catch (e) {
    console.error('Error fetching activity from IndexedDB:', e);
  }

  return {
    date,
    caloriesBurned: 0,
    carbsBurned: 0,
    lastUpdated: new Date().toISOString()
  };
}

export async function saveActivityForDate(activity: DailyActivity, settings: AppSettings): Promise<void> {
  const localKey = `${ACTIVITY_PREFIX}${activity.date}`;
  await set(localKey, activity);

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive(`activity-${activity.date}.json`, activity, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync activity to Google Drive:', e);
    }
  }
}

export async function exportAllDataAsJson(): Promise<string> {
  const settings = await getAppSettings();
  const exportData: Record<string, any> = {
    settings,
    exportDate: new Date().toISOString(),
    version: '3.0.0'
  };
  return JSON.stringify(exportData, null, 2);
}
