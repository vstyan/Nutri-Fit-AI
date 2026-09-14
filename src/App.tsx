import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CameraCapture } from './components/CameraCapture';
import { MealReviewModal } from './components/MealReviewModal';
import { SettingsModal } from './components/SettingsModal';
import { StoragePromptModal } from './components/StoragePromptModal';
import { UpdatePrompt } from './components/UpdatePrompt';
import { 
  AppSettings, 
  MealRecord, 
  DailyActivity, 
  DailySummary, 
  GeminiAnalysisResult,
  StorageLocation,
  WeightRecord,
  WorkoutEntry
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
  getAllFavoriteMeals,
  toggleFavoriteMeal,
  DEFAULT_SETTINGS,
  getInitialSettingsSynchronous
} from './services/storageService';
import { calculateBMR, calculateDailyTEF, calculateTDEE } from './utils/calorieEngine';
import { getLocalDateString, addDaysToDateString, getPastNDaysDateStrings } from './utils/dateUtils';
import { requestGoogleFitAccessToken, fetchGoogleFitCalories, GoogleFitCaloriesResult } from './services/googleFitService';

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
  const [favoriteMeals, setFavoriteMeals] = useState<MealRecord[]>([]);
  const [yesterdayMeals, setYesterdayMeals] = useState<MealRecord[]>([]);

  // Google Fit state
  const [isConnectingGoogleFit, setIsConnectingGoogleFit] = useState(false);
  const [isSyncingGoogleFit, setIsSyncingGoogleFit] = useState(false);

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

  const [historyData, setHistoryData] = useState<Array<{
    date: string;
    carbsIntake: number;
    fiberIntake?: number;
    netCarbsIntake?: number;
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }>>([]);

  // Modals state
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState('');
  const [reviewResult, setReviewResult] = useState<GeminiAnalysisResult | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealRecord | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoragePromptOpen, setIsStoragePromptOpen] = useState(false);

  // Theme mode sync (Apple Pure Black vs Midnight Slate)
  useEffect(() => {
    const theme = settings.themeMode || 'apple_dark';
    const root = document.documentElement;
    const metaThemeColor = document.getElementById('app-theme-color');
    if (theme === 'midnight_slate') {
      root.classList.remove('theme-apple');
      root.classList.add('theme-midnight');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#020617');
    } else {
      root.classList.remove('theme-midnight');
      root.classList.add('theme-apple');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
    }
  }, [settings.themeMode]);

  // Initial load of settings & automatic Google Fit startup sync
  useEffect(() => {
    getAppSettings().then(loaded => {
      setSettings(loaded);
      if (!loaded.storagePromptDismissed) {
        setIsStoragePromptOpen(true);
      }
      if (loaded.googleFitConnected) {
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
    currentSettings: AppSettings = settings,
    isManual: boolean = false,
    allowInteractiveRefresh: boolean = true
  ) => {
    if (!currentSettings.googleFitConnected) {
      if (isManual) {
        alert('Google Fit is not connected. Please click Connect Google Fit first.');
      }
      return;
    }

    let activeToken = currentSettings.googleFitAccessToken;
    const isExpired = !activeToken || (currentSettings.googleFitTokenExpiry && Date.now() >= (currentSettings.googleFitTokenExpiry - 60000));

    // If token is missing or expired, automatically renew using saved user hint
    if (isExpired && (isManual || allowInteractiveRefresh)) {
      try {
        const { accessToken: newToken, expiresIn, email } = await requestGoogleFitAccessToken(
          currentSettings.googleClientId,
          currentSettings.googleFitUserEmail
        );
        activeToken = newToken;
        currentSettings = {
          ...currentSettings,
          googleFitAccessToken: newToken,
          googleFitTokenExpiry: Date.now() + (expiresIn * 1000),
          googleFitUserEmail: email || currentSettings.googleFitUserEmail
        };
        await saveAppSettings(currentSettings);
        setSettings(currentSettings);
      } catch (tokenErr) {
        console.warn('Google Fit automatic renewal paused:', tokenErr);
        if (isManual) {
          alert('Google Fit authorization expired. Please connect Google Fit again.');
        }
        return;
      }
    }

    if (!activeToken) return;

    setIsSyncingGoogleFit(true);
    try {
      let fitResult: GoogleFitCaloriesResult;
      try {
        fitResult = await fetchGoogleFitCalories(date, activeToken);
      } catch (fetchErr: any) {
        if (fetchErr.message === 'UNAUTHORIZED' && (isManual || allowInteractiveRefresh)) {
          // Token expired mid-call; refresh token using saved user hint
          const { accessToken: newToken, expiresIn, email } = await requestGoogleFitAccessToken(
            currentSettings.googleClientId,
            currentSettings.googleFitUserEmail
          );
          activeToken = newToken;
          currentSettings = {
            ...currentSettings,
            googleFitAccessToken: newToken,
            googleFitTokenExpiry: Date.now() + (expiresIn * 1000),
            googleFitUserEmail: email || currentSettings.googleFitUserEmail
          };
          await saveAppSettings(currentSettings);
          setSettings(currentSettings);
          fitResult = await fetchGoogleFitCalories(date, activeToken);
        } else {
          throw fetchErr;
        }
      }

      if (fitResult) {
        const includeResting = currentSettings.includeRestingCalories !== false;
        const profileBmr = calculateBMR(currentSettings.profile);
        const baseBmr = includeResting ? profileBmr : 0;
        const currentMeals = await getMealsForDate(date, currentSettings);
        const tef = calculateDailyTEF(currentMeals);
        const fitTotal = includeResting ? (baseBmr + fitResult.totalCalories) : fitResult.totalCalories;

        const updatedActivity: DailyActivity = {
          date,
          activeCaloriesBurned: fitResult.totalCalories,
          baseBmrCalories: baseBmr,
          neatCalories: 0, // Google Fit already accounts for NEAT; 0 added to prevent double counting
          tefCalories: tef,
          totalCaloriesBurned: fitTotal + tef,
          source: 'google_fit',
          lastSyncedAt: fitResult.lastSyncedAt,
          lastUpdated: new Date().toISOString()
        };

        await saveActivityForDate(updatedActivity, currentSettings);
        setActivity(updatedActivity);

        const updatedSettings: AppSettings = {
          ...currentSettings,
          googleFitLastSync: fitResult.lastSyncedAt
        };
        await saveAppSettings(updatedSettings);
        setSettings(updatedSettings);
      }
    } catch (err: any) {
      console.warn('Google Fit sync notice:', err);
    } finally {
      setIsSyncingGoogleFit(false);
    }
  }, [selectedDate, settings]);


  // Listen for window focus / visibility change / pageshow to automatically advance date and auto-sync Fit
  useEffect(() => {
    const handleActiveState = () => {
      if (document.visibilityState === 'visible' || (typeof document.hasFocus === 'function' && document.hasFocus())) {
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

        if (settings.googleFitConnected) {
          handleSyncGoogleFit(targetDate, settings, false, true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleActiveState);
    window.addEventListener('focus', handleActiveState);
    window.addEventListener('pageshow', handleActiveState);
    window.addEventListener('online', handleActiveState);

    return () => {
      document.removeEventListener('visibilitychange', handleActiveState);
      window.removeEventListener('focus', handleActiveState);
      window.removeEventListener('pageshow', handleActiveState);
      window.removeEventListener('online', handleActiveState);
    };
  }, [selectedDate, settings, handleSyncGoogleFit]);

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

        if (settings.googleFitConnected) {
          // Run silent check (only if token is currently active)
          handleSyncGoogleFit(selectedDate, settings, false, false);
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [selectedDate, settings, handleSyncGoogleFit]);

  // Auto-sync Google Fit when date changes if connected
  useEffect(() => {
    if (settings.googleFitConnected) {
      handleSyncGoogleFit(selectedDate, settings, false, true);
    }
  }, [selectedDate, settings.googleFitConnected]);

  // Load day data
  const loadDayData = useCallback(async (date: string, currentSettings: AppSettings) => {
    const dayMeals = await getMealsForDate(date, currentSettings);
    const dayActivity = await getActivityForDate(date, currentSettings);
    const dayWeight = await getWeightForDate(date);
    const wHistory = await getWeightHistory(14);
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

    const tdeeBreakdown = calculateTDEE({
      bmr: baseBmr,
      activeCalories: dayActivity.activeCaloriesBurned || 0,
      meals: dayMeals,
      source: dayActivity.source,
      isGoogleFitConnected: currentSettings.googleFitConnected,
      includeResting
    });

    const synchedActivity: DailyActivity = {
      ...dayActivity,
      baseBmrCalories: baseBmr,
      neatCalories: tdeeBreakdown.neat,
      tefCalories: dayTef,
      totalCaloriesBurned: tdeeBreakdown.totalBurned,
      source: isFit ? 'google_fit' : (dayActivity.source || 'manual')
    };

    // Save updated activity
    await saveActivityForDate(synchedActivity, currentSettings);

    setMeals(dayMeals);
    setActivity(synchedActivity);
    setCurrentWeight(dayWeight);
    setWeightHistory(wHistory);
    setFavoriteMeals(allFavs);
    setYesterdayMeals(yMeals);

    // Load past 7 days for trend charts
    const past7: Array<{
      date: string;
      carbsIntake: number;
      fiberIntake?: number;
      netCarbsIntake?: number;
      carbsBurned: number;
      caloriesIntake: number;
      caloriesBurned: number;
    }> = [];

    const past7Dates = getPastNDaysDateStrings(7, date);
    for (const dStr of past7Dates) {
      const mList = await getMealsForDate(dStr, currentSettings);
      const act = await getActivityForDate(dStr, currentSettings);

      const cIn = Math.round(mList.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10;
      const fibIn = Math.round(mList.reduce((s, m) => s + (m.totalFiber || 0), 0) * 10) / 10;
      const netCIn = Math.max(0, Math.round((cIn - fibIn) * 10) / 10);
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

  // Compute Daily Summary totals including Fiber, Net Carbs, and dynamic TEF
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10;
  const totalFiber = Math.round(meals.reduce((sum, m) => sum + (m.totalFiber || 0), 0) * 10) / 10;
  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const totalProtein = Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10;
  const totalFat = Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10;
  const totalCalories = Math.round(meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0));
  const tef = calculateDailyTEF(meals);

  const totals = {
    calories: totalCalories,
    carbs: totalCarbs,
    fiber: totalFiber,
    netCarbs,
    protein: totalProtein,
    fat: totalFat,
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
      {/* Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenStorageModal={() => setIsStoragePromptOpen(true)}
      />

      {/* Main Dashboard */}
      <main className="flex-1">
        <Dashboard
          summary={summary}
          settings={settings}
          historyData={historyData}
          weightHistory={weightHistory}
          favoriteMeals={favoriteMeals}
          yesterdayMeals={yesterdayMeals}
          isSyncingGoogleFit={isSyncingGoogleFit}
          onOpenCapture={() => setIsCaptureOpen(true)}
          onDeleteMeal={handleDeleteMeal}
          onEditMeal={handleEditMeal}
          onToggleFavorite={handleToggleFavorite}
          onCopyMealToToday={handleCopyMealToToday}
          onUpdateActiveBurn={handleUpdateActiveBurn}
          onAddWorkout={handleAddWorkout}
          onDeleteWorkout={handleDeleteWorkout}
          onSaveWeight={handleSaveWeight}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onConnectGoogleFit={handleConnectGoogleFit}
          onSyncGoogleFit={() => handleSyncGoogleFit(selectedDate, settings, true)}
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
        onSaveSettings={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
        onConnectGoogleFit={handleConnectGoogleFit}
        onDisconnectGoogleFit={handleDisconnectGoogleFit}
      />

      {/* Storage Destination Prompt Modal */}
      <StoragePromptModal
        isOpen={isStoragePromptOpen}
        currentLocation={settings.storageLocation}
        onSelect={handleSelectStorageLocation}
        onClose={() => setIsStoragePromptOpen(false)}
      />

      {/* PWA Update Notification Prompt */}
      <UpdatePrompt />
    </div>
  );
}

export default App;
