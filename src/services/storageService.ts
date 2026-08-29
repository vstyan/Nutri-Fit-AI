import { get, set, entries, clear as clearIdb } from 'idb-keyval';
import { AppSettings, MealRecord, DailyActivity, UserProfile, WeightRecord } from '../types';
import { calculateBMR } from '../utils/bmrCalculator';
import { getPastNDaysDateStrings } from '../utils/dateUtils';
import { saveJsonToDrive, readJsonFromDrive } from './googleDriveService';

const SETTINGS_KEY = 'nutrifit_settings_v4';
const MEALS_PREFIX = 'nutrifit_meals_';
const ACTIVITY_PREFIX = 'nutrifit_activity_';
const WEIGHT_PREFIX = 'nutrifit_weight_';

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
  includeRestingCalories: true,
  profile: DEFAULT_PROFILE,
  goals: {
    dailyCaloriesTarget: 2000,
    dailyCarbsTarget: 200,
    dailyFiberTarget: 30,
    dailyProteinTarget: 140,
    dailyFatTarget: 65,
  }
};

export interface FullBackupData {
  version: string;
  exportDate: string;
  settings: AppSettings;
  mealsByDate: Record<string, MealRecord[]>;
  activityByDate: Record<string, DailyActivity>;
  weightByDate?: Record<string, WeightRecord>;
}

export interface ImportResult {
  success: boolean;
  message: string;
  mealCount: number;
  dayCount: number;
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const localStr = localStorage.getItem(SETTINGS_KEY);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        includeRestingCalories: parsed.includeRestingCalories !== undefined ? parsed.includeRestingCalories : true,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) }
      };
    }

    const idbSaved = await get<AppSettings>(SETTINGS_KEY);
    if (idbSaved) {
      const merged = {
        ...DEFAULT_SETTINGS,
        ...idbSaved,
        includeRestingCalories: idbSaved.includeRestingCalories !== undefined ? idbSaved.includeRestingCalories : true,
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

  return localMeals.map(m => ({
    ...m,
    totalFiber: Number(m.totalFiber) || 0,
    netCarbs: m.netCarbs !== undefined ? m.netCarbs : Math.max(0, Math.round(((m.totalCarbs || 0) - (Number(m.totalFiber) || 0)) * 10) / 10)
  }));
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

export async function toggleFavoriteMeal(mealId: string, date: string, settings: AppSettings): Promise<MealRecord | null> {
  const meals = await getMealsForDate(date, settings);
  const target = meals.find(m => m.id === mealId);
  if (!target) return null;

  const updated: MealRecord = {
    ...target,
    isFavorite: !target.isFavorite
  };
  await saveMeal(updated, settings);
  return updated;
}

export async function getAllFavoriteMeals(): Promise<MealRecord[]> {
  const favorites: MealRecord[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MEALS_PREFIX)) {
      try {
        const list: MealRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
        for (const m of list) {
          if (m.isFavorite && !seenIds.has(m.id)) {
            favorites.push(m);
            seenIds.add(m.id);
          }
        }
      } catch {}
    }
  }
  return favorites;
}

export async function getActivityForDate(date: string, settings: AppSettings): Promise<DailyActivity> {
  const localKey = `${ACTIVITY_PREFIX}${date}`;
  const includeResting = settings.includeRestingCalories !== false;
  const baseBmr = includeResting ? calculateBMR(settings.profile) : 0;

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

// Weight scale tracking
export async function getWeightForDate(date: string): Promise<WeightRecord | null> {
  const key = `${WEIGHT_PREFIX}${date}`;
  try {
    const localStr = localStorage.getItem(key);
    if (localStr) return JSON.parse(localStr);
    const saved = await get<WeightRecord>(key);
    if (saved) {
      localStorage.setItem(key, JSON.stringify(saved));
      return saved;
    }
  } catch (e) {
    console.error('Error fetching weight:', e);
  }
  return null;
}

export async function saveWeightForDate(weight: WeightRecord, settings: AppSettings): Promise<void> {
  const key = `${WEIGHT_PREFIX}${weight.date}`;
  localStorage.setItem(key, JSON.stringify(weight));
  await set(key, weight);

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive(`weight-${weight.date}.json`, weight, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync weight to Google Drive:', e);
    }
  }
}

export async function getWeightHistory(days = 14): Promise<WeightRecord[]> {
  const list: WeightRecord[] = [];
  const dateStrings = getPastNDaysDateStrings(days);

  for (const dStr of dateStrings) {
    const rec = await getWeightForDate(dStr);
    if (rec) {
      list.push(rec);
    }
  }
  return list;
}

export async function exportAllDataAsJson(): Promise<string> {
  const settings = await getAppSettings();
  const mealsByDate: Record<string, MealRecord[]> = {};
  const activityByDate: Record<string, DailyActivity> = {};
  const weightByDate: Record<string, WeightRecord> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(MEALS_PREFIX)) {
      const date = key.replace(MEALS_PREFIX, '');
      try {
        mealsByDate[date] = JSON.parse(localStorage.getItem(key) || '[]');
      } catch {}
    } else if (key.startsWith(ACTIVITY_PREFIX)) {
      const date = key.replace(ACTIVITY_PREFIX, '');
      try {
        activityByDate[date] = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {}
    } else if (key.startsWith(WEIGHT_PREFIX)) {
      const date = key.replace(WEIGHT_PREFIX, '');
      try {
        weightByDate[date] = JSON.parse(localStorage.getItem(key) || '{}');
      } catch {}
    }
  }

  try {
    const idbEntries = await entries();
    for (const [key, value] of idbEntries) {
      const kStr = String(key);
      if (kStr.startsWith(MEALS_PREFIX)) {
        const date = kStr.replace(MEALS_PREFIX, '');
        if (!mealsByDate[date] || mealsByDate[date].length === 0) {
          mealsByDate[date] = value as MealRecord[];
        }
      } else if (kStr.startsWith(ACTIVITY_PREFIX)) {
        const date = kStr.replace(ACTIVITY_PREFIX, '');
        if (!activityByDate[date]) {
          activityByDate[date] = value as DailyActivity;
        }
      } else if (kStr.startsWith(WEIGHT_PREFIX)) {
        const date = kStr.replace(WEIGHT_PREFIX, '');
        if (!weightByDate[date]) {
          weightByDate[date] = value as WeightRecord;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read all IDB entries for export:', e);
  }

  const exportData: FullBackupData = {
    version: '5.0.0',
    exportDate: new Date().toISOString(),
    settings,
    mealsByDate,
    activityByDate,
    weightByDate
  };

  return JSON.stringify(exportData, null, 2);
}

export async function importBackupJson(jsonString: string): Promise<ImportResult> {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format: file does not contain a valid JSON object.');
    }

    let mealCount = 0;
    const restoredDates = new Set<string>();

    if (data.settings) {
      await saveAppSettings({
        ...DEFAULT_SETTINGS,
        ...data.settings,
        includeRestingCalories: data.settings.includeRestingCalories !== undefined ? data.settings.includeRestingCalories : true,
        profile: { ...DEFAULT_PROFILE, ...(data.settings.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(data.settings.goals || {}) }
      });
    }

    if (data.mealsByDate && typeof data.mealsByDate === 'object') {
      for (const [date, mealList] of Object.entries(data.mealsByDate)) {
        if (Array.isArray(mealList) && mealList.length > 0) {
          const key = `${MEALS_PREFIX}${date}`;
          localStorage.setItem(key, JSON.stringify(mealList));
          await set(key, mealList);
          mealCount += mealList.length;
          restoredDates.add(date);
        }
      }
    }

    if (data.activityByDate && typeof data.activityByDate === 'object') {
      for (const [date, activityObj] of Object.entries(data.activityByDate)) {
        if (activityObj && typeof activityObj === 'object') {
          const key = `${ACTIVITY_PREFIX}${date}`;
          localStorage.setItem(key, JSON.stringify(activityObj));
          await set(key, activityObj);
          restoredDates.add(date);
        }
      }
    }

    if (data.weightByDate && typeof data.weightByDate === 'object') {
      for (const [date, weightObj] of Object.entries(data.weightByDate)) {
        if (weightObj && typeof weightObj === 'object') {
          const key = `${WEIGHT_PREFIX}${date}`;
          localStorage.setItem(key, JSON.stringify(weightObj));
          await set(key, weightObj);
          restoredDates.add(date);
        }
      }
    }

    return {
      success: true,
      message: `Successfully restored ${mealCount} meal(s) across ${restoredDates.size} day(s)!`,
      mealCount,
      dayCount: restoredDates.size
    };
  } catch (err: any) {
    console.error('Error importing backup:', err);
    throw new Error(err.message || 'Failed to parse and import backup file.');
  }
}

export async function clearAllAppData(keepSettings = true): Promise<void> {
  const currentSettings = await getAppSettings();

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('nutrifit_') || k.startsWith(MEALS_PREFIX) || k.startsWith(ACTIVITY_PREFIX) || k.startsWith(WEIGHT_PREFIX))) {
      if (keepSettings && k === SETTINGS_KEY) continue;
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  try {
    await clearIdb();
    if (keepSettings) {
      await saveAppSettings(currentSettings);
    }
  } catch (e) {
    console.error('Error clearing IndexedDB:', e);
  }
}
