import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CameraCapture } from './components/CameraCapture';
import { MealReviewModal } from './components/MealReviewModal';
import { SettingsModal } from './components/SettingsModal';
import { StoragePromptModal } from './components/StoragePromptModal';
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

export function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [currentWeight, setCurrentWeight] = useState<WeightRecord | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightRecord[]>([]);
  const [favoriteMeals, setFavoriteMeals] = useState<MealRecord[]>([]);
  const [yesterdayMeals, setYesterdayMeals] = useState<MealRecord[]>([]);

  const [activity, setActivity] = useState<DailyActivity>(() => {
    const base = calculateBMR(DEFAULT_SETTINGS.profile);
    return {
      date: selectedDate,
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

  // Load day data
  const loadDayData = useCallback(async (date: string, currentSettings: AppSettings) => {
    const dayMeals = await getMealsForDate(date, currentSettings);
    const dayActivity = await getActivityForDate(date, currentSettings);
    const dayWeight = await getWeightForDate(date);
    const wHistory = await getWeightHistory(14);
    const allFavs = await getAllFavoriteMeals();

    // Load yesterday's meals for 1-tap quick copying
    const dObj = new Date(date + 'T00:00:00');
    dObj.setDate(dObj.getDate() - 1);
    const yStr = dObj.toISOString().split('T')[0];
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

    const baseDate = new Date(date + 'T00:00:00');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      const mList = await getMealsForDate(dStr, currentSettings);
      const act = await getActivityForDate(dStr, currentSettings);

      const cIn = Math.round(mList.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10;
      const fibIn = Math.round(mList.reduce((s, m) => s + (m.totalFiber || 0), 0) * 10) / 10;
      const netCIn = Math.max(0, Math.round((cIn - fibIn) * 10) / 10);
      const calIn = Math.round(mList.reduce((s, m) => s + (m.totalCalories || 0), 0));

      past7.push({
        date: dStr,
        carbsIntake: cIn,
        fiberIntake: fibIn,
        netCarbsIntake: netCIn,
        carbsBurned: 0,
        caloriesIntake: calIn,
        caloriesBurned: act.totalCaloriesBurned || 1700
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

  // Save reviewed meal
  const handleSaveMeal = async (meal: MealRecord) => {
    await saveMeal(meal, settings);
    setIsReviewOpen(false);
    setReviewResult(null);
    setReviewPhotoUrl('');
    loadDayData(selectedDate, settings);
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
    const baseBmr = calculateBMR(settings.profile);
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

  const summary: DailySummary = {
    date: selectedDate,
    meals,
    activity,
    weightRecord: currentWeight || undefined,
    totals,
    netCalories: totals.calories - (activity.totalCaloriesBurned || 1700)
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
          onOpenCapture={() => setIsCaptureOpen(true)}
          onDeleteMeal={handleDeleteMeal}
          onToggleFavorite={handleToggleFavorite}
          onCopyMealToToday={handleCopyMealToToday}
          onUpdateActiveBurn={handleUpdateActiveBurn}
          onSaveWeight={handleSaveWeight}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </main>

      {/* Camera / Text / Voice Capture Modal */}
      <CameraCapture
        isOpen={isCaptureOpen}
        geminiApiKey={settings.geminiApiKey}
        onAnalysisComplete={handleAnalysisComplete}
        onClose={() => setIsCaptureOpen(false)}
      />

      {/* Meal Review & 1-Tap Save Modal */}
      {reviewResult && (
        <MealReviewModal
          isOpen={isReviewOpen}
          photoUrl={reviewPhotoUrl}
          initialResult={reviewResult}
          targetDate={selectedDate}
          onSave={handleSaveMeal}
          onCancel={() => {
            setIsReviewOpen(false);
            setReviewResult(null);
          }}
        />
      )}

      {/* Settings & Profile Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Storage Destination Prompt Modal */}
      <StoragePromptModal
        isOpen={isStoragePromptOpen}
        currentLocation={settings.storageLocation}
        onSelect={handleSelectStorageLocation}
        onClose={() => setIsStoragePromptOpen(false)}
      />
    </div>
  );
}

export default App;
