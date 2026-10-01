import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, X } from 'lucide-react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CameraCapture } from './components/CameraCapture';
import { MealReviewModal } from './components/MealReviewModal';
import { SettingsModal } from './components/SettingsModal';
import { StoragePromptModal } from './components/StoragePromptModal';
import { UpdatePrompt } from './components/UpdatePrompt';
import { DocumentationModal } from './components/DocumentationModal';
import { TermsModal } from './components/TermsModal';
import { TERMS_VERSION } from './constants/termsContent';
import { 
  AppSettings, 
  MealRecord, 
  DailyActivity, 
  DailySummary, 
  GeminiAnalysisResult,
  StorageLocation,
  WeightRecord,
  WorkoutEntry,
  BloodLipidRecord,
  HistoryDayRecord
} from './types';
import { 
  getAppSettings, 
  saveAppSettings, 
  getMealsForDate, 
  saveMeal, 
  deleteMeal, 
  getActivityForDate, 
  saveActivityForDate,
  getWeightForDate,
  saveWeightForDate,
  getWeightHistory,
  getLipidHistory,
  saveLipidRecord,
  deleteLipidRecord,
  getAllFavoriteMeals,
  toggleFavoriteMeal,
  DEFAULT_SETTINGS,
  getInitialSettingsSynchronous,
  saveTermsAccepted
} from './services/storageService';
import { calculateBMR, calculateDailyTEF, calculateTDEE } from './utils/calorieEngine';
import { getLocalDateString, addDaysToDateString, getPastNDaysDateStrings } from './utils/dateUtils';
import { requestGoogleFitAccessToken, fetchGoogleFitCalories, GoogleFitCaloriesResult } from './services/googleFitService';
import { 
  isNativeAndroid, 
  requestHealthConnectPermissions, 
  syncHealthConnectDaily, 
  openHealthConnectSettings 
} from './services/healthBridge';

export function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const lastActiveTimeRef = useRef<number>(Date.now());

  const handleDateChange = useCallback((newDate: string) => {
    lastActiveTimeRef.current = Date.now();
    setSelectedDate(newDate);
  }, []);

  const [settings, setSettings] = useState<AppSettings>(() => getInitialSettingsSynchronous());
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [currentWeight, setCurrentWeight] = useState<WeightRecord | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightRecord[]>([]);
  const [lipidHistory, setLipidHistory] = useState<BloodLipidRecord[]>([]);
  const [favoriteMeals, setFavoriteMeals] = useState<MealRecord[]>([]);
  const [yesterdayMeals, setYesterdayMeals] = useState<MealRecord[]>([]);

  // Google Fit state
  const [isConnectingGoogleFit, setIsConnectingGoogleFit] = useState(false);
  const [isSyncingGoogleFit, setIsSyncingGoogleFit] = useState(false);

  // Health Connect state (Android APK)
  const isAndroidApp = isNativeAndroid();
  const [isConnectingHealthConnect, setIsConnectingHealthConnect] = useState(false);
  const [isSyncingHealthConnect, setIsSyncingHealthConnect] = useState(false);

  // Sync locks & settings ref to prevent infinite re-render sync loops
  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const isSyncingGoogleFitRef = useRef(false);
  const isSyncingHealthConnectRef = useRef(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Documentation modal state
  const [isDocumentationOpen, setIsDocumentationOpen] = useState(false);
  const [documentationSection, setDocumentationSection] = useState('gemini-key');

  const handleOpenDocumentation = useCallback((section: string = 'gemini-key') => {
    setDocumentationSection(section);
    setIsDocumentationOpen(true);
  }, []);

  const showOfflineNotice = useCallback((message: string) => {
    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current);
    }
    setOfflineNotice(message);
    offlineTimerRef.current = setTimeout(() => {
      setOfflineNotice(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
      }
    };
  }, []);

  const [activity, setActivity] = useState<DailyActivity>(() => {
    const includeResting = DEFAULT_SETTINGS.includeRestingCalories !== false;
    const base = includeResting ? calculateBMR(DEFAULT_SETTINGS.profile) : 0;
    const neat = includeResting ? Math.round(base * 0.15) : 0;
    return {
      date: getLocalDateString(),
      activeCaloriesBurned: 0,
      baseBmrCalories: base,
      neatCalories: neat,
      tefCalories: 0,
      totalCaloriesBurned: base + neat,
      lastUpdated: new Date().toISOString()
    };
  });

  const [historyData, setHistoryData] = useState<HistoryDayRecord[]>([]);

  // Modals state
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState('');
  const [reviewResult, setReviewResult] = useState<GeminiAnalysisResult | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoragePromptOpen, setIsStoragePromptOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(() => {
    const init = getInitialSettingsSynchronous();
    return !init.termsAcceptedVersion || init.termsAcceptedVersion !== TERMS_VERSION;
  });
  const [isTermsBlocking, setIsTermsBlocking] = useState(() => {
    const init = getInitialSettingsSynchronous();
    return !init.termsAcceptedVersion || init.termsAcceptedVersion !== TERMS_VERSION;
  });

  // Theme mode sync (Pure Black OLED vs Teal Breeze vs Midnight Slate)
  useEffect(() => {
    const rawTheme = (settings.themeMode as string) || 'pure_black';
    // Fallback any previously selected nordic_teal to teal_breeze
    const theme = rawTheme === 'nordic_teal' ? 'teal_breeze' : rawTheme;
    const root = document.documentElement;
    const metaThemeColor = document.getElementById('app-theme-color');
    root.classList.remove('theme-pure-black', 'theme-midnight', 'theme-teal-breeze', 'theme-nordic-teal', 'theme-apple');
    
    if (theme === 'teal_breeze') {
      root.classList.add('theme-teal-breeze');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#F0FDFA');
    } else if (theme === 'midnight_slate') {
      root.classList.add('theme-midnight');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#020617');
    } else {
      root.classList.add('theme-pure-black');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
    }
  }, [settings.themeMode]);

  // Initial load of settings & automatic Google Fit startup sync
  useEffect(() => {
    getAppSettings().then(loaded => {
      setSettings(loaded);
      const termsAccepted = loaded.termsAcceptedVersion === TERMS_VERSION;
      if (!termsAccepted) {
        setIsTermsBlocking(true);
        setIsTermsOpen(true);
      } else if (!loaded.storagePromptDismissed) {
        setIsStoragePromptOpen(true);
      }
      if (loaded.healthConnectConnected) {
        handleSyncHealthConnect(selectedDate, loaded, false);
      } else if (loaded.googleFitConnected) {
        handleSyncGoogleFit(selectedDate, loaded, false, true);
      }
    });
  }, []);

  // Google Fit Connect Handler
  const handleConnectGoogleFit = async () => {
    setIsConnectingGoogleFit(true);
    try {
      const { accessToken, expiresIn, email } = await requestGoogleFitAccessToken(
        settings.googleClientId,
        settings.googleFitUserEmail
      );
      const now = Date.now();
      const updatedSettings: AppSettings = {
        ...settings,
        includeRestingCalories: false,
        googleFitConnected: true,
        googleFitAccessToken: accessToken,
        googleFitTokenExpiry: now + (expiresIn * 1000),
        googleFitLastSync: new Date().toISOString(),
        googleFitUserEmail: email || settings.googleFitUserEmail
      };
      await saveAppSettings(updatedSettings);
      setSettings(updatedSettings);

      // Immediately sync calories from Google Fit for selected date
      await handleSyncGoogleFit(selectedDate, updatedSettings, true, true);
    } catch (err: any) {
      console.error('Google Fit connection failed:', err);
      alert(err.message || 'Failed to connect Google Fit. Please allow the popup and try again.');
    } finally {
      setIsConnectingGoogleFit(false);
    }
  };

  // Google Fit Disconnect Handler
  const handleDisconnectGoogleFit = async () => {
    const updatedSettings: AppSettings = {
      ...settings,
      includeRestingCalories: true,
      googleFitConnected: false,
      googleFitAccessToken: undefined,
      googleFitTokenExpiry: undefined,
      googleFitLastSync: undefined,
      googleFitUserEmail: undefined
    };
    await saveAppSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  // Google Fit Sync Calories for a Date (Supports automatic launch & active state re-auth)
  const handleSyncGoogleFit = useCallback(async (
    date: string = selectedDate, 
    currentSettings?: AppSettings,
    isManual: boolean = false,
    allowInteractiveRefresh: boolean = true
  ) => {
    let activeSettings = currentSettings || settingsRef.current;
    if (!activeSettings.googleFitConnected) {
      if (isManual) {
        alert('Google Fit is not connected. Please click Connect Google Fit first.');
      }
      return;
    }

    if (isSyncingGoogleFitRef.current) return;
    isSyncingGoogleFitRef.current = true;
    setIsSyncingGoogleFit(true);
    try {
      if (!navigator.onLine) {
        if (isManual) {
          showOfflineNotice('You appear to be offline. Displaying your last synced Google Fit data until your connection returns.');
        }
        return;
      }

      let activeToken = activeSettings.googleFitAccessToken;
      const isExpired = !activeToken || (activeSettings.googleFitTokenExpiry && Date.now() >= (activeSettings.googleFitTokenExpiry - 60000));

      // If token is missing or expired, automatically renew using saved user hint
      if (isExpired && (isManual || allowInteractiveRefresh)) {
        try {
          const { accessToken: newToken, expiresIn, email } = await requestGoogleFitAccessToken(
            activeSettings.googleClientId,
            activeSettings.googleFitUserEmail
          );
          activeToken = newToken;
          activeSettings = {
            ...activeSettings,
            googleFitAccessToken: newToken,
            googleFitTokenExpiry: Date.now() + (expiresIn * 1000),
            googleFitUserEmail: email || activeSettings.googleFitUserEmail
          };
          await saveAppSettings(activeSettings);
          setSettings(activeSettings);
        } catch (tokenErr) {
          console.warn('Google Fit automatic renewal paused:', tokenErr);
          if (isManual) {
            if (!navigator.onLine) {
              showOfflineNotice('You appear to be offline. Displaying your last synced Google Fit data until your connection returns.');
            } else {
              showOfflineNotice('Google Fit authorization expired. Please connect Google Fit again.');
            }
          }
          return;
        }
      }

      if (!activeToken) return;

      let fitResult: GoogleFitCaloriesResult;
      const profileBmr = calculateBMR(activeSettings.profile);
      try {
        fitResult = await fetchGoogleFitCalories(date, activeToken, profileBmr);
      } catch (fetchErr: any) {
        if (fetchErr.message === 'UNAUTHORIZED' && (isManual || allowInteractiveRefresh)) {
          // Token expired mid-call; refresh token using saved user hint
          const { accessToken: newToken, expiresIn, email } = await requestGoogleFitAccessToken(
            activeSettings.googleClientId,
            activeSettings.googleFitUserEmail
          );
          activeToken = newToken;
          activeSettings = {
            ...activeSettings,
            googleFitAccessToken: newToken,
            googleFitTokenExpiry: Date.now() + (expiresIn * 1000),
            googleFitUserEmail: email || activeSettings.googleFitUserEmail
          };
          await saveAppSettings(activeSettings);
          setSettings(activeSettings);
          fitResult = await fetchGoogleFitCalories(date, activeToken, profileBmr);
        } else {
          throw fetchErr;
        }
      }

      if (fitResult) {
        const includeResting = activeSettings.includeRestingCalories !== false;
        const baseBmr = includeResting ? profileBmr : 0;
        const currentMeals = await getMealsForDate(date, activeSettings);
        const tef = calculateDailyTEF(currentMeals);
        const fitTotal = includeResting ? (baseBmr + fitResult.totalCalories) : fitResult.totalCalories;

        const currentActivity = await getActivityForDate(date, activeSettings);
        const existingWorkouts = Array.isArray(currentActivity?.workouts) ? currentActivity.workouts : [];
        const detectedWorkouts = Array.isArray(fitResult.detectedWorkouts) ? fitResult.detectedWorkouts : [];

        // Preserve non-Google Fit manual workouts entered by user
        const manualWorkouts = existingWorkouts.filter(w => !w.id.startsWith('gfit-'));

        // Deduplicate detected workouts against user's manual workouts (e.g. within 45 min)
        const nonDuplicateDetected = detectedWorkouts.filter(dw => {
          const dwTime = new Date(dw.timestamp).getTime();
          return !manualWorkouts.some(mw => {
            const mwTime = new Date(mw.timestamp).getTime();
            return !isNaN(mwTime) && !isNaN(dwTime) && Math.abs(mwTime - dwTime) < 45 * 60 * 1000;
          });
        });

        const mergedWorkouts = [...manualWorkouts, ...nonDuplicateDetected];

        const updatedActivity: DailyActivity = {
          date,
          activeCaloriesBurned: fitTotal,
          baseBmrCalories: baseBmr,
          neatCalories: 0, // Google Fit already accounts for NEAT; 0 added to prevent double counting
          tefCalories: tef,
          totalCaloriesBurned: fitTotal + tef,
          workouts: mergedWorkouts,
          source: 'google_fit',
          lastSyncedAt: fitResult.lastSyncedAt,
          lastUpdated: new Date().toISOString()
        };

        await saveActivityForDate(updatedActivity, activeSettings);
        setActivity(updatedActivity);

        const updatedSettings: AppSettings = {
          ...activeSettings,
          googleFitLastSync: fitResult.lastSyncedAt
        };
        await saveAppSettings(updatedSettings);
        setSettings(updatedSettings);
      }
    } catch (err: any) {
      console.warn('Google Fit sync notice:', err);
      if (isManual) {
        if (!navigator.onLine) {
          showOfflineNotice('You appear to be offline. Displaying your last synced Google Fit data until your connection returns.');
        } else {
          showOfflineNotice('Unable to reach Google Fit right now. Displaying your last synced data until your connection returns.');
        }
      }
    } finally {
      isSyncingGoogleFitRef.current = false;
      setIsSyncingGoogleFit(false);
    }
  }, [selectedDate, showOfflineNotice]);

  // Health Connect Connect Handler (Native Android APK)
  const handleConnectHealthConnect = async () => {
    setIsConnectingHealthConnect(true);
    try {
      const res = await requestHealthConnectPermissions();
      if (res.success) {
        const now = new Date().toISOString();
        const updatedSettings: AppSettings = {
          ...settings,
          includeRestingCalories: true,
          healthConnectConnected: true,
          healthSyncProvider: 'health_connect',
          healthConnectLastSync: now,
          googleFitConnected: false // Avoid conflicting background syncs
        };
        await saveAppSettings(updatedSettings);
        setSettings(updatedSettings);

        // Immediately sync data for current selected date
        await handleSyncHealthConnect(selectedDate, updatedSettings, true);
      } else {
        if (res.error) {
          alert(`Health Connect permission notice: ${res.error}`);
        }
      }
    } catch (err: any) {
      console.error('Health Connect connection failed:', err);
      alert(err?.message || 'Failed to connect Health Connect.');
    } finally {
      setIsConnectingHealthConnect(false);
    }
  };

  // Health Connect Disconnect Handler
  const handleDisconnectHealthConnect = async () => {
    const updatedSettings: AppSettings = {
      ...settings,
      includeRestingCalories: true,
      healthConnectConnected: false,
      healthConnectLastSync: undefined,
      healthSyncProvider: 'manual'
    };
    await saveAppSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  // Health Connect Sync Calories for a Date
  const handleSyncHealthConnect = useCallback(async (
    date: string = selectedDate,
    currentSettings?: AppSettings,
    isManual: boolean = false
  ) => {
    const activeSettings = currentSettings || settingsRef.current;
    if (!activeSettings.healthConnectConnected) {
      if (isManual) {
        alert('Health Connect is not connected. Please connect Health Connect first in Settings.');
      }
      return;
    }

    if (isSyncingHealthConnectRef.current) return;
    isSyncingHealthConnectRef.current = true;
    setIsSyncingHealthConnect(true);
    try {
      const healthResult = await syncHealthConnectDaily(date);
      if (healthResult) {
        const profileBmr = calculateBMR(activeSettings.profile);
        const restingBmr = (healthResult.basalCalories && healthResult.basalCalories > 0)
          ? healthResult.basalCalories
          : profileBmr;

        let burnValue: number;
        let baseBmr: number;

        if (healthResult.totalCalories > 0) {
          // Wearable reported exact cumulative or 24-hr total burn (e.g. 1237 kcal)
          burnValue = healthResult.totalCalories;
          baseBmr = 0; // Already included inside wearable total
        } else {
          // Wearable only logged active calories (e.g. 317 kcal) without totalCalories records.
          // Add resting BMR so user's daily burn includes basal expenditure!
          baseBmr = restingBmr;
          burnValue = baseBmr + healthResult.activeCalories;
        }

        const currentMeals = await getMealsForDate(date, activeSettings);
        const tef = calculateDailyTEF(currentMeals);

        const currentActivity = await getActivityForDate(date, activeSettings);
        const existingWorkouts = Array.isArray(currentActivity?.workouts) ? currentActivity.workouts : [];

        const updatedActivity: DailyActivity = {
          date,
          activeCaloriesBurned: burnValue,
          baseBmrCalories: baseBmr,
          neatCalories: 0, // Health Connect / wearable already accounts for NEAT; 0 added to prevent double counting
          tefCalories: tef,
          totalCaloriesBurned: burnValue + tef,
          workouts: existingWorkouts,
          source: 'health_connect',
          lastSyncedAt: healthResult.lastSyncedAt,
          lastUpdated: new Date().toISOString()
        };

        await saveActivityForDate(updatedActivity, activeSettings);
        setActivity(updatedActivity);

        const updatedSettings: AppSettings = {
          ...activeSettings,
          healthConnectLastSync: healthResult.lastSyncedAt
        };
        await saveAppSettings(updatedSettings);
        setSettings(updatedSettings);
      }
    } catch (err: any) {
      console.warn('Health Connect sync notice:', err);
      if (isManual) {
        alert('Failed to sync Health Connect: ' + (err?.message || 'Unknown error'));
      }
    } finally {
      isSyncingHealthConnectRef.current = false;
      setIsSyncingHealthConnect(false);
    }
  }, [selectedDate]);

  // Listen for visibility change / pageshow to automatically advance date and auto-sync Fit / Health Connect (with 5-minute cooldown)
  useEffect(() => {
    const handleActiveState = () => {
      if (document.visibilityState === 'visible') {
        const todayStr = getLocalDateString();
        const elapsedMinutes = (Date.now() - lastActiveTimeRef.current) / (60 * 1000);
        lastActiveTimeRef.current = Date.now();

        let targetDate = selectedDate;
        // If viewing a past date and either:
        // 1. App was inactive/backgrounded for > 15 minutes (or resumed from previous session days ago)
        // 2. The previous date was yesterday (overnight midnight rollover)
        // Automatically advance to today
        if (selectedDate < todayStr && (elapsedMinutes > 15 || selectedDate === addDaysToDateString(todayStr, -1))) {
          targetDate = todayStr;
          setSelectedDate(todayStr);
        }

        // Avoid hammering background sync on transient view changes: require at least 5 minutes since last sync
        const lastHealthSync = settingsRef.current.healthConnectLastSync
          ? new Date(settingsRef.current.healthConnectLastSync).getTime()
          : 0;
        const lastFitSync = settingsRef.current.googleFitLastSync
          ? new Date(settingsRef.current.googleFitLastSync).getTime()
          : 0;
        const lastSync = Math.max(lastHealthSync, lastFitSync);

        if (Date.now() - lastSync < 5 * 60 * 1000) {
          return;
        }

        if (settingsRef.current.healthConnectConnected) {
          handleSyncHealthConnect(targetDate, settingsRef.current, false);
        } else if (settingsRef.current.googleFitConnected) {
          handleSyncGoogleFit(targetDate, settingsRef.current, false, true);
        }
      }
    };

    const handleOnline = () => {
      setOfflineNotice(null);
      handleActiveState();
    };

    document.addEventListener('visibilitychange', handleActiveState);
    window.addEventListener('pageshow', handleActiveState);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleActiveState);
      window.removeEventListener('pageshow', handleActiveState);
      window.removeEventListener('online', handleOnline);
    };
  }, [selectedDate, handleSyncGoogleFit, handleSyncHealthConnect]);

  // Periodic background sync every 5 minutes while app is open and visible
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const todayStr = getLocalDateString();
        // If midnight rolled over while app was continuously open, advance to today
        if (selectedDate === addDaysToDateString(todayStr, -1)) {
          setSelectedDate(todayStr);
          return;
        }

        if (settingsRef.current.healthConnectConnected) {
          handleSyncHealthConnect(selectedDate, settingsRef.current, false);
        } else if (settingsRef.current.googleFitConnected) {
          // Run silent check (only if token is currently active)
          handleSyncGoogleFit(selectedDate, settingsRef.current, false, false);
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [selectedDate, handleSyncGoogleFit, handleSyncHealthConnect]);

  // Auto-sync Health Connect or Google Fit when date changes if connected
  useEffect(() => {
    if (settings.healthConnectConnected) {
      handleSyncHealthConnect(selectedDate, settingsRef.current, false);
    } else if (settings.googleFitConnected) {
      handleSyncGoogleFit(selectedDate, settingsRef.current, false, true);
    }
  }, [selectedDate, settings.healthConnectConnected, settings.googleFitConnected]);

  // Load day data
  const loadDayData = useCallback(async (date: string, currentSettings: AppSettings) => {
    const dayMeals = await getMealsForDate(date, currentSettings);
    const dayActivity = await getActivityForDate(date, currentSettings);
    const dayWeight = await getWeightForDate(date);
    const wHistory = await getWeightHistory(14);
    const lHistory = await getLipidHistory();
    const allFavs = await getAllFavoriteMeals();

    // Load yesterday's meals for 1-tap quick copying
    const yStr = addDaysToDateString(date, -1);
    const yMeals = await getMealsForDate(yStr, currentSettings);

    // Calculate dynamic TEF from logged nutrition
    const dayTef = calculateDailyTEF(dayMeals);

    // Calculate TDEE breakdown: Total Burned = BMR + NEAT + EAT + TEF
    const includeResting = currentSettings.includeRestingCalories !== false;
    const profileBmr = calculateBMR(currentSettings.profile);
    const baseBmr = includeResting ? (dayActivity.baseBmrCalories || profileBmr) : 0;
    const isFit = dayActivity.source === 'google_fit' || !!currentSettings.googleFitConnected;
    const isHC = dayActivity.source === 'health_connect' || !!currentSettings.healthConnectConnected;

    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: dayActivity.activeCaloriesBurned || 0,
      meals: dayMeals,
      source: dayActivity.source,
      isGoogleFitConnected: currentSettings.googleFitConnected,
      isHealthConnectConnected: currentSettings.healthConnectConnected,
      includeResting
    });

    const synchedActivity: DailyActivity = {
      ...dayActivity,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: dayTef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      source: isHC ? 'health_connect' : (isFit ? 'google_fit' : (dayActivity.source || 'manual'))
    };

    // Save updated activity
    await saveActivityForDate(synchedActivity, currentSettings);

    setMeals(dayMeals);
    setActivity(synchedActivity);
    setCurrentWeight(dayWeight);
    setWeightHistory(wHistory);
    setLipidHistory(lHistory);
    setFavoriteMeals(allFavs);
    setYesterdayMeals(yMeals);

    // Load past 7 days for trend charts
    const past7: HistoryDayRecord[] = [];

    const past7Dates = getPastNDaysDateStrings(7, date);
    for (const dStr of past7Dates) {
      const mList = await getMealsForDate(dStr, currentSettings);
      const act = await getActivityForDate(dStr, currentSettings);

      const cIn = Math.round(mList.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10;
      const fibIn = Math.round(mList.reduce((s, m) => s + (m.totalFiber || 0), 0) * 10) / 10;
      const netCIn = Math.max(0, Math.round((cIn - fibIn) * 10) / 10);
      const protIn = Math.round(mList.reduce((s, m) => s + (m.totalProtein || 0), 0) * 10) / 10;
      const fatIn = Math.round(mList.reduce((s, m) => s + (m.totalFat || 0), 0) * 10) / 10;
      const cholIn = Math.round(mList.reduce((s, m) => s + (m.totalCholesterol || 0), 0));
      const calIn = Math.round(mList.reduce((s, m) => s + (m.totalCalories || 0), 0));

      const pastBmr = includeResting ? calculateBMR(currentSettings.profile) : 0;
      const pastBreakdown = calculateTDEE({
        bmr: pastBmr,
        activeCalories: act.activeCaloriesBurned || 0,
        meals: mList,
        source: act.source,
        isGoogleFitConnected: currentSettings.googleFitConnected && dStr === date,
        includeResting
      });

      past7.push({
        date: dStr,
        carbsIntake: cIn,
        fiberIntake: fibIn,
        netCarbsIntake: netCIn,
        proteinIntake: protIn,
        fatIntake: fatIn,
        cholesterolIntake: cholIn,
        carbsBurned: 0,
        caloriesIntake: calIn,
        caloriesBurned: pastBreakdown.totalBurned
      });
    }

    setHistoryData(past7);
  }, []);

  useEffect(() => {
    loadDayData(selectedDate, settings);
  }, [selectedDate, settings, loadDayData]);

  // Handle Photo or Text/Voice Analysis Completion
  const handleAnalysisComplete = (photoUrl: string, result: GeminiAnalysisResult) => {
    setReviewPhotoUrl(photoUrl);
    setReviewResult(result);
    setIsCaptureOpen(false);
    setIsReviewOpen(true);
  };

  // Save meal from review or edit
  const handleSaveMeal = async (meal: MealRecord) => {
    try {
      await saveMeal(meal, settings);
    } catch (err) {
      console.error('Error saving meal:', err);
    } finally {
      setIsReviewOpen(false);
      setReviewResult(null);
      setReviewPhotoUrl('');
      setEditingMeal(null);
      try {
        await loadDayData(selectedDate, settings);
      } catch (loadErr) {
        console.warn('Error reloading day data:', loadErr);
      }
    }
  };

  // Open edit modal for an existing logged meal
  const handleEditMeal = (meal: MealRecord) => {
    setEditingMeal(meal);
    setReviewPhotoUrl(meal.photoUrl || '');
    setReviewResult(null);
    setIsReviewOpen(true);
  };

  // Delete meal
  const handleDeleteMeal = async (mealId: string) => {
    await deleteMeal(mealId, selectedDate, settings);
    loadDayData(selectedDate, settings);
  };

  // Toggle favorite
  const handleToggleFavorite = async (mealId: string) => {
    await toggleFavoriteMeal(mealId, selectedDate, settings);
    loadDayData(selectedDate, settings);
  };

  // Copy meal to today
  const handleCopyMealToToday = async (sourceMeal: MealRecord) => {
    const duplicated: MealRecord = {
      ...sourceMeal,
      id: `meal-${Date.now()}`,
      date: selectedDate,
      timestamp: new Date().toISOString()
    };
    await saveMeal(duplicated, settings);
    loadDayData(selectedDate, settings);
  };

  // Save scale body weight
  const handleSaveWeight = async (weight: WeightRecord) => {
    await saveWeightForDate(weight, settings);
    
    // Automatically update profile weight in BMR for highest metabolic accuracy
    if (weight.weightKg && weight.weightKg > 0) {
      const updatedSettings: AppSettings = {
        ...settings,
        profile: {
          ...settings.profile,
          weightKg: weight.weightKg
        }
      };
      setSettings(updatedSettings);
      await saveAppSettings(updatedSettings);
    }
    loadDayData(selectedDate, settings);
  };

  // Save blood lipid lab test record
  const handleSaveLipidRecord = async (record: BloodLipidRecord) => {
    await saveLipidRecord(record, settings);
    const updated = await getLipidHistory();
    setLipidHistory(updated);
  };

  // Delete blood lipid lab test record
  const handleDeleteLipidRecord = async (id: string) => {
    await deleteLipidRecord(id, settings);
    const updated = await getLipidHistory();
    setLipidHistory(updated);
  };

  // Update active exercise calories
  const handleUpdateActiveBurn = async (activeKcal: number) => {
    const includeResting = settings.includeRestingCalories !== false;
    const profileBmr = calculateBMR(settings.profile);
    const baseBmr = includeResting ? profileBmr : 0;
    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: activeKcal,
      meals,
      source: activity.source,
      isGoogleFitConnected: settings.googleFitConnected,
      isHealthConnectConnected: settings.healthConnectConnected,
      includeResting
    });

    const updatedActivity: DailyActivity = {
      ...activity,
      activeCaloriesBurned: activeKcal,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: tdeeBreakdown.tef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      lastUpdated: new Date().toISOString()
    };
    setActivity(updatedActivity);
    await saveActivityForDate(updatedActivity, settings);
    loadDayData(selectedDate, settings);
  };

  // Add a voice/AI estimated workout to today's activity (running total)
  const handleAddWorkout = async (workout: WorkoutEntry) => {
    const previousActive = activity.activeCaloriesBurned || 0;
    const newActiveKcal = previousActive + workout.caloriesBurned;
    const includeResting = settings.includeRestingCalories !== false;
    const baseBmr = includeResting ? calculateBMR(settings.profile) : 0;
    const existingWorkouts = Array.isArray(activity.workouts) ? activity.workouts : [];
    const updatedWorkouts = [...existingWorkouts, workout];

    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: newActiveKcal,
      meals,
      source: activity.source,
      isGoogleFitConnected: settings.googleFitConnected,
      isHealthConnectConnected: settings.healthConnectConnected,
      includeResting
    });

    const updatedActivity: DailyActivity = {
      ...activity,
      activeCaloriesBurned: newActiveKcal,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: tdeeBreakdown.tef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      workouts: updatedWorkouts,
      lastUpdated: new Date().toISOString()
    };

    setActivity(updatedActivity);
    await saveActivityForDate(updatedActivity, settings);
    loadDayData(selectedDate, settings);
  };

  // Delete a logged workout from today's activity and adjust running total
  const handleDeleteWorkout = async (workoutId: string) => {
    const existingWorkouts = Array.isArray(activity.workouts) ? activity.workouts : [];
    const workoutToDelete = existingWorkouts.find(w => w.id === workoutId);
    if (!workoutToDelete) return;

    const previousActive = activity.activeCaloriesBurned || 0;
    const newActiveKcal = Math.max(0, previousActive - (workoutToDelete.caloriesBurned || 0));
    const includeResting = settings.includeRestingCalories !== false;
    const baseBmr = includeResting ? calculateBMR(settings.profile) : 0;
    const updatedWorkouts = existingWorkouts.filter(w => w.id !== workoutId);

    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: newActiveKcal,
      meals,
      source: activity.source,
      isGoogleFitConnected: settings.googleFitConnected,
      isHealthConnectConnected: settings.healthConnectConnected,
      includeResting
    });

    const updatedActivity: DailyActivity = {
      ...activity,
      activeCaloriesBurned: newActiveKcal,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: tdeeBreakdown.tef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      workouts: updatedWorkouts,
      lastUpdated: new Date().toISOString()
    };

    setActivity(updatedActivity);
    await saveActivityForDate(updatedActivity, settings);
    loadDayData(selectedDate, settings);
  };

  // Save settings
  const handleSaveSettings = async (newSettings: AppSettings, explicitKeyUpdate = true) => {
    setSettings(newSettings);
    await saveAppSettings(newSettings, explicitKeyUpdate);
    const includeResting = newSettings.includeRestingCalories !== false;
    const baseBmr = includeResting ? calculateBMR(newSettings.profile) : 0;
    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: activity.activeCaloriesBurned || 0,
      meals,
      source: activity.source,
      isGoogleFitConnected: newSettings.googleFitConnected,
      includeResting
    });

    const updatedActivity: DailyActivity = {
      ...activity,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: tdeeBreakdown.tef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      lastUpdated: new Date().toISOString()
    };
    setActivity(updatedActivity);
    await saveActivityForDate(updatedActivity, newSettings);
    loadDayData(selectedDate, newSettings);
  };

  // Select storage location from prompt
  const handleSelectStorageLocation = async (location: StorageLocation) => {
    const updated: AppSettings = {
      ...settings,
      storageLocation: location,
      storagePromptDismissed: true
    };
    setSettings(updated);
    await saveAppSettings(updated);
    setIsStoragePromptOpen(false);
  };

  // Accept Terms of Service & Health Disclaimer
  const handleAcceptTerms = async () => {
    const updated = await saveTermsAccepted(TERMS_VERSION, settings);
    setSettings(updated);
    setIsTermsOpen(false);
    setIsTermsBlocking(false);
    if (!updated.storagePromptDismissed) {
      setIsStoragePromptOpen(true);
    }
  };

  // Compute Daily Summary totals including Fiber, Net Carbs, and dynamic TEF
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10;
  const totalFiber = Math.round(meals.reduce((sum, m) => sum + (m.totalFiber || 0), 0) * 10) / 10;
  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10;
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10;
  const totalUnsaturatedFat = Math.round(meals.reduce((sum, m) => sum + (m.totalUnsaturatedFat ?? 0), 0) * 10) / 10;
  const totalSaturatedFat = Math.round(meals.reduce((sum, m) => sum + (m.totalSaturatedFat ?? 0), 0) * 10) / 10;
  const totalTransFat = Math.round(meals.reduce((sum, m) => sum + (m.totalTransFat ?? 0), 0) * 10) / 10;
  const totalCholesterol = Math.round(meals.reduce((sum, m) => sum + (m.totalCholesterol ?? 0), 0));
  const totalCalories = Math.round(meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0));
  const tef = calculateDailyTEF(meals);

  const totals = {
    calories: totalCalories,
    carbs: totalCarbs,
    fiber: totalFiber,
    netCarbs,
    protein: totalProtein,
    fat: totalFat,
    unsaturatedFat: totalUnsaturatedFat,
    saturatedFat: totalSaturatedFat,
    transFat: totalTransFat,
    cholesterol: totalCholesterol,
    tef
  };

  const includeResting = settings.includeRestingCalories !== false;
  const profileBmr = calculateBMR(settings.profile);
  const baseBmr = includeResting ? (activity.baseBmrCalories || profileBmr) : 0;

  const tdeeBreakdown = calculateTDEE({
    bmr: baseBmr,
    activeCalories: activity.activeCaloriesBurned || 0,
    meals,
    source: activity.source,
    isGoogleFitConnected: settings.googleFitConnected,
    isHealthConnectConnected: settings.healthConnectConnected,
    includeResting
  });

  const summary: DailySummary = {
    date: selectedDate,
    meals,
    activity: {
      ...activity,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: tdeeBreakdown.tef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned
    },
    weightRecord: currentWeight || undefined,
    totals,
    burnBreakdown: {
      bmr: tdeeBreakdown.bmr,
      neat: tdeeBreakdown.neat,
      eat: tdeeBreakdown.eat,
      tef: tdeeBreakdown.tef,
      total: tdeeBreakdown.totalBurned
    },
    netCalories: totals.calories - tdeeBreakdown.totalBurned
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Offline Toast Notification */}
      {offlineNotice && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-slate-900/95 backdrop-blur-md border border-amber-500/40 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-medium leading-snug text-slate-200">
              {offlineNotice}
            </p>
          </div>
          <button
            onClick={() => setOfflineNotice(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenStorageModal={() => setIsStoragePromptOpen(true)}
        onOpenDocumentation={() => handleOpenDocumentation('gemini-key')}
      />

      {/* Main Dashboard */}
      <main className="flex-1">
        <Dashboard
          summary={summary}
          settings={settings}
          historyData={historyData}
          weightHistory={weightHistory}
          lipidHistory={lipidHistory}
          favoriteMeals={favoriteMeals}
          yesterdayMeals={yesterdayMeals}
          isSyncingGoogleFit={isSyncingGoogleFit}
          isSyncingHealthConnect={isSyncingHealthConnect}
          isNativeAndroid={isAndroidApp}
          onOpenCapture={() => setIsCaptureOpen(true)}
          onDeleteMeal={handleDeleteMeal}
          onEditMeal={handleEditMeal}
          onToggleFavorite={handleToggleFavorite}
          onCopyMealToToday={handleCopyMealToToday}
          onUpdateActiveBurn={handleUpdateActiveBurn}
          onAddWorkout={handleAddWorkout}
          onDeleteWorkout={handleDeleteWorkout}
          onSaveWeight={handleSaveWeight}
          onSaveLipidRecord={handleSaveLipidRecord}
          onDeleteLipidRecord={handleDeleteLipidRecord}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenDocumentation={handleOpenDocumentation}
          onConnectGoogleFit={handleConnectGoogleFit}
          onSyncGoogleFit={() => handleSyncGoogleFit(selectedDate, settings, true)}
          onConnectHealthConnect={handleConnectHealthConnect}
          onSyncHealthConnect={() => handleSyncHealthConnect(selectedDate, settings, true)}
        />
      </main>

      {/* Camera / Text / Voice Capture Modal */}
      <CameraCapture
        isOpen={isCaptureOpen}
        geminiApiKey={settings.geminiApiKey}
        onAnalysisComplete={handleAnalysisComplete}
        onClose={() => setIsCaptureOpen(false)}
      />

      {/* Meal Review & Edit Modal */}
      {(reviewResult || editingMeal) && (
        <MealReviewModal
          isOpen={isReviewOpen}
          photoUrl={reviewPhotoUrl}
          initialResult={reviewResult}
          editingMeal={editingMeal}
          targetDate={selectedDate}
          geminiApiKey={settings.geminiApiKey}
          onSave={handleSaveMeal}
          onCancel={() => {
            setIsReviewOpen(false);
            setReviewResult(null);
            setReviewPhotoUrl('');
            setEditingMeal(null);
          }}
        />
      )}

      {/* Settings & Profile Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        isConnectingGoogleFit={isConnectingGoogleFit}
        isConnectingHealthConnect={isConnectingHealthConnect}
        isNativeAndroid={isAndroidApp}
        onSaveSettings={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
        onOpenDocumentation={handleOpenDocumentation}
        onConnectGoogleFit={handleConnectGoogleFit}
        onDisconnectGoogleFit={handleDisconnectGoogleFit}
        onConnectHealthConnect={handleConnectHealthConnect}
        onDisconnectHealthConnect={handleDisconnectHealthConnect}
        onOpenHealthConnectSettings={openHealthConnectSettings}
        onOpenTerms={() => {
          setIsTermsBlocking(false);
          setIsTermsOpen(true);
        }}
      />

      {/* NutriFit AI Guide & Documentation Modal */}
      <DocumentationModal
        isOpen={isDocumentationOpen}
        onClose={() => setIsDocumentationOpen(false)}
        initialSection={documentationSection}
      />

      {/* Storage Destination Prompt Modal */}
      <StoragePromptModal
        isOpen={isStoragePromptOpen}
        currentLocation={settings.storageLocation}
        onSelect={handleSelectStorageLocation}
        onClose={() => setIsStoragePromptOpen(false)}
      />

      {/* Terms of Service & Health Disclaimer Modal */}
      <TermsModal
        isOpen={isTermsOpen}
        isBlocking={isTermsBlocking}
        acceptedDate={settings.termsAcceptedDate}
        onAccept={handleAcceptTerms}
        onClose={() => setIsTermsOpen(false)}
      />

      {/* PWA Update Notification Prompt */}
      <UpdatePrompt />
    </div>
  );
}

export default App;
