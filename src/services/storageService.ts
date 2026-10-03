import { get, set, entries, clear as clearIdb } from 'idb-keyval';
import { 
  AppSettings, 
  MealRecord, 
  DailyActivity, 
  UserProfile, 
  WeightRecord, 
  BloodLipidRecord,
  DailyCoachInsight,
  WeeklyCoachInsight,
  StorageLocation
} from '../types';
import { calculateBMR } from '../utils/bmrCalculator';
import { getEffectiveTrackingMode } from '../utils/calorieEngine';
import { isNativeAndroid } from './healthBridge';
import { getPastNDaysDateStrings } from '../utils/dateUtils';
import { saveJsonToDrive, readJsonFromDrive } from './googleDriveService';

const SETTINGS_KEY = 'nutrifit_settings_v4';
const MEALS_PREFIX = 'nutrifit_meals_';
const ACTIVITY_PREFIX = 'nutrifit_activity_';
const WEIGHT_PREFIX = 'nutrifit_weight_';
const LIPID_HISTORY_KEY = 'nutrifit_lipid_history';
const DAILY_INSIGHT_PREFIX = 'nutrifit_daily_insight_';
const WEEKLY_INSIGHT_PREFIX = 'nutrifit_weekly_insight_';

export const DEFAULT_PROFILE: UserProfile = {
  gender: 'male',
  age: 32,
  weightKg: 75, // ~165 lbs
  heightCm: 175, // ~5'9"
  unitSystem: 'imperial',
  customBmr: undefined
};

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  storageLocation: 'local_indexeddb',
  storagePromptDismissed: false,
  burnTrackingMode: 'standalone',
  includeRestingCalories: true,
  themeMode: 'pure_black',
  profile: DEFAULT_PROFILE,
  goals: {
    dailyCaloriesTarget: 2000,
    dailyCarbsTarget: 200,
    dailyFiberTarget: 30,
    dailyProteinTarget: 140,
    dailyFatTarget: 65,
    dailyCholesterolTarget: 300,
    primaryGoals: [],
  }
};

export interface FullBackupData {
  version: string;
  exportDate: string;
  settings: AppSettings;
  mealsByDate: Record<string, MealRecord[]>;
  activityByDate: Record<string, DailyActivity>;
  weightByDate?: Record<string, WeightRecord>;
  lipidHistory?: BloodLipidRecord[];
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

export const STORAGE_PROMPT_DISMISSED_KEY = 'nutrifit_storage_prompt_dismissed';
export const STORAGE_LOCATION_KEY = 'nutrifit_storage_location';

export function getInitialSettingsSynchronous(): AppSettings {
  const stickyKey = getStickyGeminiKeySynchronous();
  const dismissedSync = localStorage.getItem(STORAGE_PROMPT_DISMISSED_KEY) === 'true';
  const locationSync = (localStorage.getItem(STORAGE_LOCATION_KEY) as StorageLocation) || undefined;

  try {
    const localStr = localStorage.getItem(SETTINGS_KEY);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        storagePromptDismissed: parsed.storagePromptDismissed ?? dismissedSync,
        storageLocation: parsed.storageLocation || locationSync || DEFAULT_SETTINGS.storageLocation,
        geminiApiKey: (parsed.geminiApiKey && parsed.geminiApiKey.trim().length > 0)
          ? parsed.geminiApiKey.trim()
          : stickyKey,
        includeRestingCalories: parsed.includeRestingCalories !== undefined ? parsed.includeRestingCalories : true,
        burnTrackingMode: parsed.burnTrackingMode || 'standalone',
        termsAcceptedVersion: parsed.termsAcceptedVersion || localStorage.getItem('nutrifit_terms_accepted_version') || undefined,
        termsAcceptedDate: parsed.termsAcceptedDate || localStorage.getItem('nutrifit_terms_accepted_date') || undefined,
        profile: { ...DEFAULT_PROFILE, ...(parsed.profile || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) }
      };
    }
  } catch {}

  return {
    ...DEFAULT_SETTINGS,
    storagePromptDismissed: dismissedSync,
    storageLocation: locationSync || DEFAULT_SETTINGS.storageLocation,
    termsAcceptedVersion: localStorage.getItem('nutrifit_terms_accepted_version') || undefined,
    termsAcceptedDate: localStorage.getItem('nutrifit_terms_accepted_date') || undefined,
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

    const dismissedSync = localStorage.getItem(STORAGE_PROMPT_DISMISSED_KEY) === 'true';
    const locationSync = (localStorage.getItem(STORAGE_LOCATION_KEY) as StorageLocation) || undefined;

    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(idbSaved || {}),
      ...(parsedLocal || {}),
      storagePromptDismissed: Boolean(parsedLocal?.storagePromptDismissed || idbSaved?.storagePromptDismissed || dismissedSync),
      storageLocation: parsedLocal?.storageLocation || idbSaved?.storageLocation || locationSync || DEFAULT_SETTINGS.storageLocation,
      includeRestingCalories: (parsedLocal?.includeRestingCalories ?? idbSaved?.includeRestingCalories) !== undefined
        ? (parsedLocal?.includeRestingCalories ?? idbSaved?.includeRestingCalories)
        : true,
      termsAcceptedVersion: (parsedLocal?.termsAcceptedVersion ?? idbSaved?.termsAcceptedVersion) || localStorage.getItem('nutrifit_terms_accepted_version') || undefined,
      termsAcceptedDate: (parsedLocal?.termsAcceptedDate ?? idbSaved?.termsAcceptedDate) || localStorage.getItem('nutrifit_terms_accepted_date') || undefined,
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

  if (finalSettings.storagePromptDismissed) {
    try {
      localStorage.setItem(STORAGE_PROMPT_DISMISSED_KEY, 'true');
    } catch {}
  }
  if (finalSettings.storageLocation) {
    try {
      localStorage.setItem(STORAGE_LOCATION_KEY, finalSettings.storageLocation);
    } catch {}
  }

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

export async function saveStorageLocationChoice(location: StorageLocation, settings: AppSettings): Promise<AppSettings> {
  try {
    localStorage.setItem(STORAGE_PROMPT_DISMISSED_KEY, 'true');
    localStorage.setItem(STORAGE_LOCATION_KEY, location);
  } catch {}

  const updatedSettings: AppSettings = {
    ...settings,
    storageLocation: location,
    storagePromptDismissed: true
  };
  await saveAppSettings(updatedSettings);
  return updatedSettings;
}

export async function saveTermsAccepted(version: string, settings: AppSettings): Promise<AppSettings> {
  const acceptedDate = new Date().toISOString();
  try {
    localStorage.setItem('nutrifit_terms_accepted_version', version);
    localStorage.setItem('nutrifit_terms_accepted_date', acceptedDate);
  } catch {}

  const updatedSettings: AppSettings = {
    ...settings,
    termsAcceptedVersion: version,
    termsAcceptedDate: acceptedDate
  };
  await saveAppSettings(updatedSettings);
  return updatedSettings;
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
  const trackingMode = getEffectiveTrackingMode(settings, isNativeAndroid());
  const isTrackerMode = trackingMode === 'tracker';
  const includeResting = settings.includeRestingCalories !== false;
  const profileBmr = calculateBMR(settings.profile);

  const parseActivityRecord = (parsed: any): DailyActivity => {
    const active = Number(parsed.activeCaloriesBurned ?? parsed.caloriesBurned) || 0;
    const isSensorSource = isTrackerMode ||
      parsed.source === 'google_fit' ||
      parsed.source === 'health_connect' ||
      settings.healthConnectConnected;

    const tef = Number(parsed.tefCalories) || 0;

    let baseBmr: number;
    let neat: number;
    let totalBurned: number;
    let source: 'manual' | 'google_fit' | 'health_connect';

    if (isSensorSource) {
      source = parsed.source || 'health_connect';
      // In tracker mode: sensors/wearables account for daily movement (NEAT is 0 to prevent double counting).
      // Base BMR is preserved from sensorRestingCalories or parsed.baseBmrCalories if available, otherwise 0.
      neat = 0;
      baseBmr = parsed.sensorRestingCalories !== undefined 
        ? Number(parsed.sensorRestingCalories) 
        : (parsed.baseBmrCalories !== undefined ? Number(parsed.baseBmrCalories) : 0);
      totalBurned = parsed.totalCaloriesBurned !== undefined 
        ? Number(parsed.totalCaloriesBurned) 
        : active + tef;
    } else {
      source = 'manual';
      baseBmr = includeResting ? profileBmr : 0;
      neat = includeResting ? (parsed.neatCalories !== undefined ? Number(parsed.neatCalories) : Math.round(baseBmr * 0.15)) : 0;
      totalBurned = baseBmr + neat + active + tef;
    }

    return {
      date,
      activeCaloriesBurned: active,
      baseBmrCalories: baseBmr,
      neatCalories: neat,
      tefCalories: tef,
      totalCaloriesBurned: totalBurned,
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
      notes: parsed.notes,
      source,
      lastSyncedAt: parsed.lastSyncedAt,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      sensorActiveCalories: parsed.sensorActiveCalories !== undefined ? Number(parsed.sensorActiveCalories) : undefined,
      sensorRestingCalories: parsed.sensorRestingCalories !== undefined ? Number(parsed.sensorRestingCalories) : undefined,
      sensorProjectedTotal: parsed.sensorProjectedTotal !== undefined ? Number(parsed.sensorProjectedTotal) : undefined,
      healthDiagnostics: parsed.healthDiagnostics
    };
  };

  try {
    const localStr = localStorage.getItem(localKey);
    if (localStr) {
      return parseActivityRecord(JSON.parse(localStr));
    }
    const saved = await get<any>(localKey);
    if (saved) {
      const act = parseActivityRecord(saved);
      localStorage.setItem(localKey, JSON.stringify(act));
      return act;
    }
  } catch (e) {
    console.error('Error fetching activity:', e);
  }

  // Fallback defaults
  if (isTrackerMode) {
    return {
      date,
      activeCaloriesBurned: 0,
      baseBmrCalories: 0,
      neatCalories: 0,
      tefCalories: 0,
      totalCaloriesBurned: 0,
      workouts: [],
      source: 'health_connect',
      lastUpdated: new Date().toISOString()
    };
  }

  const defaultBmr = includeResting ? profileBmr : 0;
  const defaultNeat = includeResting ? Math.round(defaultBmr * 0.15) : 0;
  return {
    date,
    activeCaloriesBurned: 0,
    baseBmrCalories: defaultBmr,
    neatCalories: defaultNeat,
    tefCalories: 0,
    totalCaloriesBurned: defaultBmr + defaultNeat,
    workouts: [],
    source: 'manual',
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

export async function getLipidHistory(): Promise<BloodLipidRecord[]> {
  try {
    const localStr = localStorage.getItem(LIPID_HISTORY_KEY);
    if (localStr) {
      const parsed = JSON.parse(localStr);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.date.localeCompare(a.date));
      }
    }
    const saved = await withIdbTimeout(get<BloodLipidRecord[]>(LIPID_HISTORY_KEY), undefined);
    if (saved && Array.isArray(saved)) {
      try {
        localStorage.setItem(LIPID_HISTORY_KEY, JSON.stringify(saved));
      } catch {}
      return saved.sort((a, b) => b.date.localeCompare(a.date));
    }
  } catch (e) {
    console.error('Error fetching lipid history:', e);
  }
  return [];
}

export async function saveLipidRecord(record: BloodLipidRecord, settings: AppSettings): Promise<void> {
  const history = await getLipidHistory();
  const filtered = history.filter(r => r.id !== record.id && r.date !== record.date);
  const updated = [record, ...filtered].sort((a, b) => b.date.localeCompare(a.date));

  try {
    localStorage.setItem(LIPID_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    cleanOldPhotosFromLocalStorage();
    try {
      localStorage.setItem(LIPID_HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  }

  try {
    await withIdbTimeout(set(LIPID_HISTORY_KEY, updated), undefined);
  } catch (idbErr) {
    console.error('IndexedDB save failed for lipid record:', idbErr);
  }

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive('lipid-history.json', updated, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync lipid history to Google Drive:', e);
    }
  }
}

export async function deleteLipidRecord(id: string, settings: AppSettings): Promise<void> {
  const history = await getLipidHistory();
  const updated = history.filter(r => r.id !== id);

  try {
    localStorage.setItem(LIPID_HISTORY_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await withIdbTimeout(set(LIPID_HISTORY_KEY, updated), undefined);
  } catch (idbErr) {
    console.error('IndexedDB delete failed for lipid record:', idbErr);
  }

  if (settings.storageLocation === 'google_drive' && settings.googleAccessToken) {
    try {
      await saveJsonToDrive('lipid-history.json', updated, settings.googleAccessToken);
    } catch (e) {
      console.warn('Could not sync deleted lipid history to Google Drive:', e);
    }
  }
}

export async function exportAllDataAsJson(): Promise<string> {
  const settings = await getAppSettings();
  const mealsByDate: Record<string, MealRecord[]> = {};
  const activityByDate: Record<string, DailyActivity> = {};
  const weightByDate: Record<string, WeightRecord> = {};
  const lipidHistory = await getLipidHistory();

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
    weightByDate,
    lipidHistory
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

    if (Array.isArray(data.lipidHistory) && data.lipidHistory.length > 0) {
      localStorage.setItem(LIPID_HISTORY_KEY, JSON.stringify(data.lipidHistory));
      await set(LIPID_HISTORY_KEY, data.lipidHistory);
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

/**
 * AI Coach Insights Cache (IndexedDB & LocalStorage)
 */
export async function getCachedDailyInsight(date: string): Promise<DailyCoachInsight | null> {
  try {
    const key = `${DAILY_INSIGHT_PREFIX}${date}`;
    const idbVal = await get<DailyCoachInsight>(key);
    if (idbVal) return idbVal;
    const lsVal = localStorage.getItem(key);
    if (lsVal) return JSON.parse(lsVal);
    return null;
  } catch (err) {
    console.warn('Failed to retrieve cached daily insight:', err);
    return null;
  }
}

export async function saveCachedDailyInsight(date: string, insight: DailyCoachInsight): Promise<void> {
  try {
    const key = `${DAILY_INSIGHT_PREFIX}${date}`;
    localStorage.setItem(key, JSON.stringify(insight));
    await set(key, insight);
  } catch (err) {
    console.warn('Failed to save cached daily insight:', err);
  }
}

export async function clearCachedDailyInsight(date: string): Promise<void> {
  try {
    const key = `${DAILY_INSIGHT_PREFIX}${date}`;
    localStorage.removeItem(key);
    await set(key, undefined);
  } catch (err) {
    console.warn('Failed to clear cached daily insight:', err);
  }
}

export async function getCachedWeeklyInsight(weekKey: string): Promise<WeeklyCoachInsight | null> {
  try {
    const key = `${WEEKLY_INSIGHT_PREFIX}${weekKey}`;
    const idbVal = await get<WeeklyCoachInsight>(key);
    if (idbVal) return idbVal;
    const lsVal = localStorage.getItem(key);
    if (lsVal) return JSON.parse(lsVal);
    return null;
  } catch (err) {
    console.warn('Failed to retrieve cached weekly insight:', err);
    return null;
  }
}

export async function saveCachedWeeklyInsight(weekKey: string, insight: WeeklyCoachInsight): Promise<void> {
  try {
    const key = `${WEEKLY_INSIGHT_PREFIX}${weekKey}`;
    localStorage.setItem(key, JSON.stringify(insight));
    await set(key, insight);
  } catch (err) {
    console.warn('Failed to save cached weekly insight:', err);
  }
}

export async function clearCachedWeeklyInsight(weekKey: string): Promise<void> {
  try {
    const key = `${WEEKLY_INSIGHT_PREFIX}${weekKey}`;
    localStorage.removeItem(key);
    await set(key, undefined);
  } catch (err) {
    console.warn('Failed to clear cached weekly insight:', err);
  }
}
