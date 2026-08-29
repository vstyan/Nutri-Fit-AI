import React, { useState, useEffect, useCallback } from 'react';
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
  WeightRecord
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
  DEFAULT_SETTINGS
} from './services/storageService';
import { calculateBMR } from './utils/bmrCalculator';
import { getLocalDateString, addDaysToDateString, getPastNDaysDateStrings } from './utils/dateUtils';
import { requestGoogleFitAccessToken, fetchGoogleFitCalories, GoogleFitCaloriesResult } from './services/googleFitService';

export function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
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
    return {
      date: getLocalDateString(),
      activeCaloriesBurned: 0,
      baseBmrCalories: base,
      totalCaloriesBurned: base,
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

  // Initial load of settings
  useEffect(() => {
    getAppSettings().then(loaded => {
      setSettings(loaded);
      if (!loaded.storagePromptDismissed) {
        setIsStoragePromptOpen(true);
      }
    });
  }, []);

  // Google Fit Connect Handler
  const handleConnectGoogleFit = async () => {
    setIsConnectingGoogleFit(true);
    try {
      const { accessToken, expiresIn } = await requestGoogleFitAccessToken(settings.googleClientId);
      const now = Date.now();
      const updatedSettings: AppSettings = {
        ...settings,
        includeRestingCalories: false,
        googleFitConnected: true,
        googleFitAccessToken: accessToken,
        googleFitTokenExpiry: now + (expiresIn * 1000),
        googleFitLastSync: new Date().toISOString()
      };
      await saveAppSettings(updatedSettings);
      setSettings(updatedSettings);

      // Immediately sync calories from Google Fit for selected date
      await handleSyncGoogleFit(selectedDate, updatedSettings);
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
      googleFitLastSync: undefined
    };
    await saveAppSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  // Google Fit Sync Calories for a Date
  const handleSyncGoogleFit = useCallback(async (
    date: string = selectedDate, 
    currentSettings: AppSettings = settings,
    isManual: boolean = false
  ) => {
    if (!currentSettings.googleFitConnected) {
      if (isManual) {
        alert('Google Fit is not connected. Please click Connect Google Fit first.');
      }
      return;
    }
    setIsSyncingGoogleFit(true);
    try {
      let activeToken = currentSettings.googleFitAccessToken;
      const isExpired = !activeToken || (currentSettings.googleFitTokenExpiry && Date.now() >= (currentSettings.googleFitTokenExpiry - 60000));

      if (isExpired) {
        try {
          const { accessToken: newToken, expiresIn } = await requestGoogleFitAccessToken(currentSettings.googleClientId);
          activeToken = newToken;
          currentSettings = {
            ...currentSettings,
            googleFitAccessToken: newToken,
            googleFitTokenExpiry: Date.now() + (expiresIn * 1000)
          };
          await saveAppSettings(currentSettings);
          setSettings(currentSettings);
        } catch (tokenErr: any) {
          console.warn('Google Fit token refresh failed:', tokenErr);
          if (isManual) {
            alert('Google Fit authorization expired. Please click Connect Google Fit to re-authorize.');
          }
          return;
        }
      }

      let fitResult: GoogleFitCaloriesResult;
      try {
        fitResult = await fetchGoogleFitCalories(date, activeToken!);
      } catch (fetchErr: any) {
        if (fetchErr.message === 'UNAUTHORIZED') {
          // Token rejected; attempt a fresh token request
          const { accessToken: newToken, expiresIn } = await requestGoogleFitAccessToken(currentSettings.googleClientId);
          activeToken = newToken;
          currentSettings = {
            ...currentSettings,
            googleFitAccessToken: newToken,
            googleFitTokenExpiry: Date.now() + (expiresIn * 1000)
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

        const updatedActivity: DailyActivity = {
          date,
          activeCaloriesBurned: fitResult.totalCalories,
          baseBmrCalories: baseBmr,
          totalCaloriesBurned: includeResting ? (baseBmr + fitResult.totalCalories) : fitResult.totalCalories,
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

        if (isManual) {
          alert(`Google Fit Sync Successful!\n\nRetrieved: ${fitResult.totalCalories} kcal from Google Cloud\n(BMR: ${fitResult.bmrCalories || 0} kcal, Active: ${fitResult.activeCalories || 0} kcal)\n\nNote: If your phone app displays a higher number, pull down to refresh inside the Google Fit phone app to upload the latest local data to Google Cloud.`);
        }
      }
    } catch (err: any) {
      console.error('Google Fit sync error:', err);
      if (isManual || err.message?.includes('Fitness API') || err.message?.includes('Google Fit API')) {
        alert(`Google Fit Sync Notice: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSyncingGoogleFit(false);
    }
  }, [selectedDate, settings]);

  // Listen for window focus / visibility change to automatically advance date and auto-sync Fit
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const todayStr = getLocalDateString();
        setSelectedDate(prev => {
          if (prev === addDaysToDateString(todayStr, -1)) {
            return todayStr;
          }
          return prev;
        });

        if (settings.googleFitConnected && settings.googleFitAccessToken) {
          handleSyncGoogleFit(selectedDate, settings);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [selectedDate, settings, handleSyncGoogleFit]);

  // Auto-sync Google Fit when date changes if connected
  useEffect(() => {
    if (settings.googleFitConnected && settings.googleFitAccessToken) {
      handleSyncGoogleFit(selectedDate, settings);
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

    setMeals(dayMeals);
    setActivity(dayActivity);
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
      const includeResting = currentSettings.includeRestingCalories !== false;
      const defaultBurn = includeResting ? calculateBMR(currentSettings.profile) : 0;

      past7.push({
        date: dStr,
        carbsIntake: cIn,
        fiberIntake: fibIn,
        netCarbsIntake: netCIn,
        carbsBurned: 0,
        caloriesIntake: calIn,
        caloriesBurned: act.totalCaloriesBurned !== undefined ? act.totalCaloriesBurned : defaultBurn
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
    await saveMeal(meal, settings);
    setIsReviewOpen(false);
    setReviewResult(null);
    setReviewPhotoUrl('');
    setEditingMeal(null);
    loadDayData(selectedDate, settings);
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
    const baseBmr = includeResting ? calculateBMR(settings.profile) : 0;
    const updatedActivity: DailyActivity = {
      ...activity,
      activeCaloriesBurned: activeKcal,
      baseBmrCalories: baseBmr,
      totalCaloriesBurned: baseBmr + activeKcal,
      lastUpdated: new Date().toISOString()
    };
    setActivity(updatedActivity);
    await saveActivityForDate(updatedActivity, settings);
    loadDayData(selectedDate, settings);
  };

  // Save settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveAppSettings(newSettings);
    const includeResting = newSettings.includeRestingCalories !== false;
    const baseBmr = includeResting ? calculateBMR(newSettings.profile) : 0;
    const updatedActivity: DailyActivity = {
      ...activity,
      baseBmrCalories: baseBmr,
      totalCaloriesBurned: baseBmr + (activity.activeCaloriesBurned || 0),
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

  // Compute Daily Summary totals including Fiber and Net Carbs
  const totalCarbs = Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10;
  const totalFiber = Math.round(meals.reduce((sum, m) => sum + (m.totalFiber || 0), 0) * 10) / 10;
  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);

  const totals = {
    calories: Math.round(meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0)),
    carbs: totalCarbs,
    fiber: totalFiber,
    netCarbs,
    protein: Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10,
    fat: Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10,
  };

  const includeResting = settings.includeRestingCalories !== false;
  const defaultBurn = includeResting ? calculateBMR(settings.profile) : 0;
  const summary: DailySummary = {
    date: selectedDate,
    meals,
    activity,
    weightRecord: currentWeight || undefined,
    totals,
    netCalories: totals.calories - (activity.totalCaloriesBurned !== undefined ? activity.totalCaloriesBurned : defaultBurn)
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <Header
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
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
