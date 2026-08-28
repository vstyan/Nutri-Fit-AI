import { get, set, clear as clearIdb } from 'idb-keyval';
import { AppSettings, MealRecord, DailyActivity, UserProfile } from '../types';
import { calculateBMR } from '../utils/bmrCalculator';
import { saveJsonToDrive, readJsonFromDrive } from './googleDriveService';

const SETTINGS_KEY = 'nutrifit_settings_v4';
const MEALS_PREFIX = 'nutrifit_meals_';
const ACTIVITY_PREFIX = 'nutrifit_activity_';

export const DEFAULT_PROFILE: UserProfile = {
  gender: 'male',
  age: 32,
  weightKg: 75, // ~165 lbs
  heightCm: 175, // ~5'9"
  unitSystem: 'imperial'
};

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  storageLocation: 'local_indexeddb',
  storagePromptDismissed: false,
  profile: DEFAULT_PROFILE,
  goals: {
    dailyCaloriesTarget: 2000,
    dailyCarbsTarget: 200,
    dailyProteinTarget: 140,
    dailyFatTarget: 65,
  }
};

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const localStr = localStorage.getItem(SETTINGS_KEY);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) }
      };
    }

    const idbSaved = await get<AppSettings>(SETTINGS_KEY);
    if (idbSaved) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...idbSaved,
        profile: { ...DEFAULT_PROFILE, ...(idbSaved.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(idbSaved.goals || {}) }
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    await set(SETTINGS_KEY, settings);
  } catch (e) {
    console.error('Error saving settings:', e);
  }

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
    const localStr = localStorage.getItem(localKey);
    if (localStr) {
      localMeals = JSON.parse(localStr);
    } else {
      localMeals = (await get<MealRecord[]>(localKey)) || [];
      if (localMeals.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(localMeals));
      }
    }
  } catch (e) {
    console.error('Error fetching meals from storage:', e);
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
        localStorage.setItem(localKey, JSON.stringify(combined));
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
  let existing: MealRecord[] = [];
  try {
    const localStr = localStorage.getItem(localKey);
    existing = localStr ? JSON.parse(localStr) : ((await get<MealRecord[]>(localKey)) || []);
  } catch {
    existing = [];
  }

  const updated = existing.filter(m => m.id !== meal.id).concat(meal);
  localStorage.setItem(localKey, JSON.stringify(updated));
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
  let existing: MealRecord[] = [];
  try {
    const localStr = localStorage.getItem(localKey);
    existing = localStr ? JSON.parse(localStr) : ((await get<MealRecord[]>(localKey)) || []);
  } catch {
    existing = [];
  }

  const updated = existing.filter(m => m.id !== mealId);
  localStorage.setItem(localKey, JSON.stringify(updated));
  await set(localKey, updated);

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive(`meals-${date}.json`, updated, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync meal deletion to Google Drive:', e);
    }
  }
}

export async function getActivityForDate(date: string, settings: AppSettings): Promise<DailyActivity> {
  const localKey = `${ACTIVITY_PREFIX}${date}`;
  const baseBmr = calculateBMR(settings.profile);

  try {
    const localStr = localStorage.getItem(localKey);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      const active = Number(parsed.activeCaloriesBurned ?? parsed.caloriesBurned) || 0;
      return {
        date,
        activeCaloriesBurned: active,
        baseBmrCalories: baseBmr,
        totalCaloriesBurned: baseBmr + active,
        notes: parsed.notes,
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    }
    const saved = await get<any>(localKey);
    if (saved) {
      const active = Number(saved.activeCaloriesBurned ?? saved.caloriesBurned) || 0;
      const act: DailyActivity = {
        date,
        activeCaloriesBurned: active,
        baseBmrCalories: baseBmr,
        totalCaloriesBurned: baseBmr + active,
        notes: saved.notes,
        lastUpdated: saved.lastUpdated || new Date().toISOString()
      };
      localStorage.setItem(localKey, JSON.stringify(act));
      return act;
    }
  } catch (e) {
    console.error('Error fetching activity:', e);
  }

  return {
    date,
    activeCaloriesBurned: 0,
    baseBmrCalories: baseBmr,
    totalCaloriesBurned: baseBmr,
    lastUpdated: new Date().toISOString()
  };
}

export async function saveActivityForDate(activity: DailyActivity, settings: AppSettings): Promise<void> {
  const localKey = `${ACTIVITY_PREFIX}${activity.date}`;
  localStorage.setItem(localKey, JSON.stringify(activity));
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
    version: '4.0.0'
  };
  return JSON.stringify(exportData, null, 2);
}

export async function clearAllAppData(keepSettings = true): Promise<void> {
  const currentSettings = await getAppSettings();

  // Clear localStorage keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('nutrifit_') || k.startsWith(MEALS_PREFIX) || k.startsWith(ACTIVITY_PREFIX))) {
      if (keepSettings && k === SETTINGS_KEY) continue;
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Clear IndexedDB
  try {
    await clearIdb();
    if (keepSettings) {
      await saveAppSettings(currentSettings);
    }
  } catch (e) {
    console.error('Error clearing IndexedDB:', e);
  }
}
