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

export const STICKY_GEMINI_KEY = 'nutrifit_gemini_api_key_persistent';
const LEGACY_SETTINGS_KEYS = [
  'nutrifit_settings_v4',
  'nutrifit_settings_v3',
  'nutrifit_settings_v2',
  'nutrifit_settings_v1',
  'nutrifit_settings'
];

function setCookie(name: string, value: string, days = 3650): void {
  try {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  } catch {
    return null;
  }
}

function removeCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  } catch {}
}

export function persistStickyGeminiKey(key: string): void {
  const clean = key ? key.trim() : '';
  if (!clean) return;

  // 1. Dedicated persistent localStorage key
  try {
    localStorage.setItem(STICKY_GEMINI_KEY, clean);
  } catch {}

  // 2. Dedicated persistent IndexedDB entry
  try {
    set(STICKY_GEMINI_KEY, clean).catch(() => {});
  } catch {}

  // 3. 10-year persistent cookie (survives iOS Safari storage flushes)
  try {
    setCookie(STICKY_GEMINI_KEY, clean);
  } catch {}
}

export function clearStickyGeminiKey(): void {
  try {
    localStorage.removeItem(STICKY_GEMINI_KEY);
  } catch {}
  try {
    set(STICKY_GEMINI_KEY, '').catch(() => {});
  } catch {}
  try {
    removeCookie(STICKY_GEMINI_KEY);
  } catch {}
}

export function getStickyGeminiKeySynchronous(): string {
  try {
    // 1. Dedicated persistent localStorage key
    const directKey = localStorage.getItem(STICKY_GEMINI_KEY);
    if (directKey && directKey.trim().length > 0) {
      return directKey.trim();
    }

    // 2. Current & legacy settings in localStorage
    for (const key of LEGACY_SETTINGS_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.geminiApiKey === 'string' && parsed.geminiApiKey.trim().length > 0) {
            const found = parsed.geminiApiKey.trim();
            persistStickyGeminiKey(found);
            return found;
          }
        }
      } catch {}
    }

    // 3. Persistent cookie fallback
    const cookieKey = getCookie(STICKY_GEMINI_KEY);
    if (cookieKey && cookieKey.trim().length > 0) {
      const found = cookieKey.trim();
      persistStickyGeminiKey(found);
      return found;
    }
  } catch {}
  return '';
}

export async function getStickyGeminiKey(): Promise<string> {
  const syncKey = getStickyGeminiKeySynchronous();
  if (syncKey) return syncKey;

  // Check dedicated key in IndexedDB
  try {
    const idbDirect = await withIdbTimeout(get<string>(STICKY_GEMINI_KEY), undefined);
    if (idbDirect && idbDirect.trim().length > 0) {
      const found = idbDirect.trim();
      persistStickyGeminiKey(found);
      return found;
    }
  } catch {}

  // Check legacy settings in IndexedDB
  for (const key of LEGACY_SETTINGS_KEYS) {
    try {
      const idbLegacy = await withIdbTimeout(get<any>(key), undefined);
      if (idbLegacy && typeof idbLegacy.geminiApiKey === 'string' && idbLegacy.geminiApiKey.trim().length > 0) {
        const found = idbLegacy.geminiApiKey.trim();
        persistStickyGeminiKey(found);
        return found;
      }
    } catch {}
  }

  return '';
}

export function getInitialSettingsSynchronous(): AppSettings {
  const stickyKey = getStickyGeminiKeySynchronous();
  try {
    const localStr = localStorage.getItem(SETTINGS_KEY);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        geminiApiKey: (parsed.geminiApiKey && parsed.geminiApiKey.trim().length > 0)
          ? parsed.geminiApiKey.trim()
          : stickyKey,
        includeRestingCalories: parsed.includeRestingCalories !== undefined ? parsed.includeRestingCalories : true,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) }
      };
    }
  } catch {}

  return {
    ...DEFAULT_SETTINGS,
    geminiApiKey: stickyKey
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  let settingsToReturn: AppSettings = getInitialSettingsSynchronous();

  try {
    const localStr = localStorage.getItem(SETTINGS_KEY);
    let parsedLocal: any = null;
    if (localStr) {
      try {
        parsedLocal = JSON.parse(localStr);
      } catch {}
    }

    let idbSaved: any = null;
    try {
      idbSaved = await withIdbTimeout(get<AppSettings>(SETTINGS_KEY), undefined);
    } catch {}

    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(idbSaved || {}),
      ...(parsedLocal || {}),
      includeRestingCalories: (parsedLocal?.includeRestingCalories ?? idbSaved?.includeRestingCalories) !== undefined
        ? (parsedLocal?.includeRestingCalories ?? idbSaved?.includeRestingCalories)
        : true,
      profile: { ...DEFAULT_PROFILE, ...(idbSaved?.profile || {}), ...(parsedLocal?.profile || {}) },
      goals: { ...DEFAULT_SETTINGS.goals, ...(idbSaved?.goals || {}) },
      geminiApiKey: (parsedLocal?.geminiApiKey || idbSaved?.geminiApiKey || '').trim()
    };

    // Recover sticky Gemini key if settings object has an empty key
    let apiKey = merged.geminiApiKey;
    if (!apiKey) {
      apiKey = await getStickyGeminiKey();
    }
    if (apiKey) {
      merged.geminiApiKey = apiKey;
      persistStickyGeminiKey(apiKey);
    }

    settingsToReturn = merged;

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      await withIdbTimeout(set(SETTINGS_KEY, merged), undefined);
    } catch {}
  } catch (e) {
    console.error('Error loading settings:', e);
  }

  return settingsToReturn;
}

export async function saveAppSettings(settings: AppSettings, explicitKeyUpdate = false): Promise<void> {
  let effectiveKey = (settings.geminiApiKey || '').trim();

  // Protect against accidental blank overwrites during app updates or background auto-saves
  if (!effectiveKey && !explicitKeyUpdate) {
    const existingSticky = getStickyGeminiKeySynchronous();
    if (existingSticky) {
      effectiveKey = existingSticky;
    }
  }

  if (effectiveKey) {
    persistStickyGeminiKey(effectiveKey);
  } else if (explicitKeyUpdate) {
    clearStickyGeminiKey();
  }

  const finalSettings: AppSettings = {
    ...settings,
    geminiApiKey: effectiveKey
  };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(finalSettings));
    await withIdbTimeout(set(SETTINGS_KEY, finalSettings), undefined);
  } catch (e) {
    console.error('Error saving settings:', e);
  }

  if (finalSettings.storageLocation === 'google_drive' && finalSettings.googleAccessToken) {
    try {
      await saveJsonToDrive('app-settings.json', finalSettings, finalSettings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync settings to Google Drive:', e);
    }
  }
}

const IDB_TIMEOUT_MS = 2500;

export function withIdbTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => {
      console.warn('IndexedDB operation timed out; falling back');
      resolve(fallback);
    }, IDB_TIMEOUT_MS))
  ]);
}

export function cleanOldPhotosFromLocalStorage(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MEALS_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw && raw.includes('data:image/')) {
            const list: MealRecord[] = JSON.parse(raw);
            const cleaned = list.map(m => ({ ...m, photoUrl: undefined }));
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        } catch {}
      }
    }
  } catch {}
}

export async function getMealsForDate(date: string, settings: AppSettings): Promise<MealRecord[]> {
  const localKey = `${MEALS_PREFIX}${date}`;
  let localMeals: MealRecord[] = [];

  try {
    const idbMeals = await withIdbTimeout(get<MealRecord[]>(localKey), undefined);
    if (idbMeals && Array.isArray(idbMeals) && idbMeals.length > 0) {
      localMeals = idbMeals;
    } else {
      const localStr = localStorage.getItem(localKey);
      if (localStr) {
        localMeals = JSON.parse(localStr);
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
        try {
          await withIdbTimeout(set(localKey, combined), undefined);
          localStorage.setItem(localKey, JSON.stringify(combined));
        } catch {}
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
    const idbMeals = await withIdbTimeout(get<MealRecord[]>(localKey), undefined);
    if (idbMeals && Array.isArray(idbMeals)) {
      existing = idbMeals;
    } else {
      const localStr = localStorage.getItem(localKey);
      existing = localStr ? JSON.parse(localStr) : [];
    }
  } catch {
    existing = [];
  }

  const updated = existing.filter(m => m.id !== meal.id).concat(meal);

  // 1. Always save to IndexedDB (virtually unlimited capacity, handles photo URLs)
  try {
    await withIdbTimeout(set(localKey, updated), undefined);
  } catch (idbErr) {
    console.error('IndexedDB save failed for meal:', idbErr);
  }

  // 2. Cache in localStorage with QuotaExceededError protection
  try {
    localStorage.setItem(localKey, JSON.stringify(updated));
  } catch (quotaErr) {
    console.warn('LocalStorage quota reached; stripping photo and cleaning old cached photos:', quotaErr);
    cleanOldPhotosFromLocalStorage();
    try {
      const stripped = updated.map(m => ({ ...m, photoUrl: undefined }));
      localStorage.setItem(localKey, JSON.stringify(stripped));
    } catch (fallbackErr) {
      console.warn('Could not cache in localStorage even after photo stripping:', fallbackErr);
    }
  }

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
    const idbMeals = await withIdbTimeout(get<MealRecord[]>(localKey), undefined);
    if (idbMeals && Array.isArray(idbMeals)) {
      existing = idbMeals;
    } else {
      const localStr = localStorage.getItem(localKey);
      existing = localStr ? JSON.parse(localStr) : [];
    }
  } catch {
    existing = [];
  }

  const updated = existing.filter(m => m.id !== mealId);

  try {
    await withIdbTimeout(set(localKey, updated), undefined);
  } catch (idbErr) {
    console.error('IndexedDB update failed on delete:', idbErr);
  }

  try {
    localStorage.setItem(localKey, JSON.stringify(updated));
  } catch {
    cleanOldPhotosFromLocalStorage();
    try {
      const stripped = updated.map(m => ({ ...m, photoUrl: undefined }));
      localStorage.setItem(localKey, JSON.stringify(stripped));
    } catch {}
  }

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
        workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
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
        workouts: Array.isArray(saved.workouts) ? saved.workouts : [],
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
    workouts: [],
    lastUpdated: new Date().toISOString()
  };
}

export async function saveActivityForDate(activity: DailyActivity, settings: AppSettings): Promise<void> {
  const localKey = `${ACTIVITY_PREFIX}${activity.date}`;
  try {
    localStorage.setItem(localKey, JSON.stringify(activity));
  } catch (e) {
    cleanOldPhotosFromLocalStorage();
    try {
      localStorage.setItem(localKey, JSON.stringify(activity));
    } catch {}
  }

  try {
    await withIdbTimeout(set(localKey, activity), undefined);
  } catch (idbErr) {
    console.error('IndexedDB save failed for activity:', idbErr);
  }

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
    const saved = await withIdbTimeout(get<WeightRecord>(key), undefined);
    if (saved) {
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {}
      return saved;
    }
  } catch (e) {
    console.error('Error fetching weight:', e);
  }
  return null;
}

export async function saveWeightForDate(weight: WeightRecord, settings: AppSettings): Promise<void> {
  const key = `${WEIGHT_PREFIX}${weight.date}`;
  try {
    localStorage.setItem(key, JSON.stringify(weight));
  } catch (e) {
    cleanOldPhotosFromLocalStorage();
    try {
      localStorage.setItem(key, JSON.stringify(weight));
    } catch {}
  }

  try {
    await withIdbTimeout(set(key, weight), undefined);
  } catch (idbErr) {
    console.error('IndexedDB save failed for weight:', idbErr);
  }

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
  const currentStickyKey = getStickyGeminiKeySynchronous() || (await getStickyGeminiKey());

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('nutrifit_') || k.startsWith(MEALS_PREFIX) || k.startsWith(ACTIVITY_PREFIX) || k.startsWith(WEIGHT_PREFIX))) {
      if (keepSettings && (k === SETTINGS_KEY || k === STICKY_GEMINI_KEY)) continue;
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (!keepSettings) {
    clearStickyGeminiKey();
  }

  try {
    await clearIdb();
    if (keepSettings) {
      if (currentStickyKey) {
        persistStickyGeminiKey(currentStickyKey);
      }
      await saveAppSettings(currentSettings);
    }
  } catch (e) {
    console.error('Error clearing IndexedDB:', e);
  }
}
