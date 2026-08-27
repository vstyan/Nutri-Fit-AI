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
  StorageLocation
} from './types';
import { 
  getAppSettings, 
  saveAppSettings, 
  getMealsForDate, 
  saveMeal, 
  deleteMeal, 
  getActivityForDate, 
  saveActivityForDate,
  DEFAULT_SETTINGS
} from './services/storageService';

export function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [activity, setActivity] = useState<DailyActivity>({
    date: selectedDate,
    caloriesBurned: 0,
    carbsBurned: 0,
    lastUpdated: new Date().toISOString()
  });

  const [historyData, setHistoryData] = useState<Array<{
    date: string;
    carbsIntake: number;
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
    const dayActivity = await getActivityForDate(date);
    setMeals(dayMeals);
    setActivity(dayActivity);

    // Load past 7 days for trend charts
    const past7: Array<{
      date: string;
      carbsIntake: number;
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
      const act = await getActivityForDate(dStr);

      const cIn = Math.round(mList.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10;
      const calIn = Math.round(mList.reduce((s, m) => s + (m.totalCalories || 0), 0));

      past7.push({
        date: dStr,
        carbsIntake: cIn,
        carbsBurned: act.carbsBurned || 0,
        caloriesIntake: calIn,
        caloriesBurned: act.caloriesBurned || 0
      });
    }

    setHistoryData(past7);
  }, []);

  useEffect(() => {
    loadDayData(selectedDate, settings);
  }, [selectedDate, settings, loadDayData]);

  // Handle Photo Analysis Completion
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

  // Update directly entered Calories Burned
  const handleUpdateCaloriesBurned = async (kcal: number) => {
    const updatedActivity: DailyActivity = {
      ...activity,
      caloriesBurned: kcal,
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

  // Compute Daily Summary
  const totals = {
    calories: Math.round(meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0)),
    carbs: Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10,
    protein: Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10,
    fat: Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10,
  };

  const summary: DailySummary = {
    date: selectedDate,
    meals,
    activity,
    totals,
    netCalories: totals.calories - (activity.caloriesBurned || 0)
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
          onOpenCapture={() => setIsCaptureOpen(true)}
          onDeleteMeal={handleDeleteMeal}
          onUpdateCaloriesBurned={handleUpdateCaloriesBurned}
        />
      </main>

      {/* Camera Capture Modal */}
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

      {/* Settings Modal */}
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
