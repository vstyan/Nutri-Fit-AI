import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Camera, 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  PieChart, 
  Wheat, 
  Scale, 
  RefreshCw, 
  Activity,
  Mic,
  Dumbbell,
  Trash2,
  Sparkles,
  Clock,
  HelpCircle,
  Heart,
  Utensils,
  Info,
  Settings
} from 'lucide-react';
import { 
  DailySummary, 
  AppSettings, 
  MealRecord, 
  WeightRecord,
  WorkoutEntry,
  BloodLipidRecord,
  HistoryDayRecord
} from '../types';
import { calculateBMR, calculateTDEE, calculateTEFBreakdown, getEffectiveTrackingMode } from '../utils/calorieEngine';
import { getLocalDateString } from '../utils/dateUtils';
import { MealHistory } from './MealHistory';
import { HistoryCharts } from './HistoryCharts';
import { WeightTrackerCard } from './WeightTrackerCard';
import { LipidTrackerCard } from './LipidTrackerCard';
import { LipidTrackerModal } from './LipidTrackerModal';
import { VoiceWorkoutModal } from './VoiceWorkoutModal';
import { AICoachCard } from './AICoachCard';

interface DashboardProps {
  summary: DailySummary;
  settings: AppSettings;
  historyData: HistoryDayRecord[];
  weightHistory: WeightRecord[];
  lipidHistory?: BloodLipidRecord[];
  favoriteMeals: MealRecord[];
  yesterdayMeals: MealRecord[];
  isSyncingHealthConnect?: boolean;
  isNativeAndroid?: boolean;
  onOpenCapture: () => void;
  onDeleteMeal: (mealId: string) => void;
  onEditMeal: (meal: MealRecord) => void;
  onToggleFavorite: (mealId: string) => void;
  onCopyMealToToday: (meal: MealRecord) => void;
  onUpdateActiveBurn: (activeKcal: number) => void;
  onAddWorkout?: (workout: WorkoutEntry) => void;
  onDeleteWorkout?: (workoutId: string) => void;
  onSaveWeight: (weight: WeightRecord) => void;
  onSaveLipidRecord?: (record: BloodLipidRecord) => void;
  onDeleteLipidRecord?: (id: string) => void;
  onOpenSettings: () => void;
  onOpenDocumentation?: (section?: string) => void;
  onConnectHealthConnect?: () => void;
  onSyncHealthConnect?: () => Promise<void> | void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  settings,
  historyData,
  weightHistory,
  lipidHistory = [],
  favoriteMeals,
  yesterdayMeals,
  isSyncingHealthConnect = false,
  isNativeAndroid = false,
  onOpenCapture,
  onDeleteMeal,
  onEditMeal,
  onToggleFavorite,
  onCopyMealToToday,
  onUpdateActiveBurn,
  onAddWorkout,
  onDeleteWorkout,
  onSaveWeight,
  onSaveLipidRecord,
  onDeleteLipidRecord,
  onOpenSettings,
  onOpenDocumentation,
  onConnectHealthConnect,
  onSyncHealthConnect
}) => {
  const [isLipidModalOpen, setIsLipidModalOpen] = useState(false);
  const [lipidModalTab, setLipidModalTab] = useState<'log' | 'history'>('log');

  const handleOpenLipidModal = (tab: 'log' | 'history' = 'log') => {
    setLipidModalTab(tab);
    setIsLipidModalOpen(true);
  };
  const { totals, activity } = summary;
  const { goals } = settings;

  const [inputActiveKcal, setInputActiveKcal] = useState<string>(
    activity.activeCaloriesBurned > 0 ? String(activity.activeCaloriesBurned) : ''
  );
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [isVoiceWorkoutOpen, setIsVoiceWorkoutOpen] = useState(false);

  // Segmented Workspace Tab: 'log' | 'coach' | 'trends'
  const [activeTab, setActiveTab] = useState<'log' | 'coach' | 'trends'>(() => {
    try {
      const saved = localStorage.getItem('nutrifit_dashboard_tab');
      if (saved === 'log' || saved === 'coach' || saved === 'trends') return saved;
    } catch {
      // fallback
    }
    return 'log';
  });

  const handleTabChange = (tab: 'log' | 'coach' | 'trends') => {
    setActiveTab(tab);
    try {
      localStorage.setItem('nutrifit_dashboard_tab', tab);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    setInputActiveKcal(activity.activeCaloriesBurned > 0 ? String(activity.activeCaloriesBurned) : '');
  }, [activity.activeCaloriesBurned, summary.date]);

  const activeKcalValue = Number(inputActiveKcal) || 0;
  const trackingMode = getEffectiveTrackingMode(settings, isNativeAndroid);
  const isTrackerMode = trackingMode === 'tracker';
  const includeResting = settings.includeRestingCalories !== false;
  const profileBmr = calculateBMR(settings.profile);
  const isSensorConnected = isTrackerMode && !!settings.healthConnectConnected;
  const sensorName = settings.healthConnectConnected ? 'Health Connect' : 'Tracker';

  const baseBmr = isTrackerMode
    ? (activity.sensorRestingCalories !== undefined 
        ? activity.sensorRestingCalories 
        : (activity.baseBmrCalories !== undefined ? activity.baseBmrCalories : 0))
    : (includeResting ? (activity.baseBmrCalories || profileBmr) : 0);

  // TDEE Engine: Total Burned = BMR + NEAT + EAT + TEF
  const tdeeBreakdown = calculateTDEE({
    bmr: baseBmr,
    activeCalories: activeKcalValue,
    meals: summary.meals,
    source: activity.source,
    trackingMode,
    isHealthConnectConnected: settings.healthConnectConnected,
    includeResting
  });

  const { bmr: burnBmr, neat: burnNeat, eat: burnEat, tef: burnTef, totalBurned } = tdeeBreakdown;
  const netCalories = totals.calories - totalBurned;
  const isCaloricDeficit = netCalories <= 0;

  // Health Connect / Google Fit sensor breakdown values
  const sensorActiveKcal = activity.sensorActiveCalories !== undefined
    ? activity.sensorActiveCalories
    : (isTrackerMode ? Math.max(0, burnEat - baseBmr) : burnEat);
  const sensorRestingKcal = activity.sensorRestingCalories !== undefined
    ? activity.sensorRestingCalories
    : (isTrackerMode ? Math.min(burnEat, baseBmr) : baseBmr);

  const tefBreakdown = calculateTEFBreakdown(totals.protein, totals.carbs, totals.fat, totals.calories);

  const handleSaveActiveBurn = (valToSave?: number) => {
    const finalVal = valToSave !== undefined ? valToSave : (Number(inputActiveKcal) || 0);
    onUpdateActiveBurn(finalVal);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 1500);
  };

  const handlePresetClick = (preset: number) => {
    setInputActiveKcal(String(preset));
    handleSaveActiveBurn(preset);
  };

  const calPercent = Math.min(Math.round((totals.calories / (goals.dailyCaloriesTarget || 2000)) * 100), 150);
  const carbPercent = Math.min(Math.round((totals.carbs / (goals.dailyCarbsTarget || 200)) * 100), 150);
  const fiberPercent = Math.min(Math.round(((totals.fiber || 0) / (goals.dailyFiberTarget || 30)) * 100), 150);
  const proteinPercent = Math.min(Math.round((totals.protein / (goals.dailyProteinTarget || 140)) * 100), 150);
  const fatPercent = Math.min(Math.round((totals.fat / (goals.dailyFatTarget || 65)) * 100), 150);

  const carbCalories = Math.round(totals.carbs * 4);
  const proteinCalories = Math.round(totals.protein * 4);
  const fatCalories = Math.round(totals.fat * 9);

  return (
    <div className="space-y-5 pb-28 max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
      {/* 1. Hero Card: Calories In vs. Total Calories Burned */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Daily Caloric Balance</h2>
              <p className="text-xs text-slate-400">
                {!isTrackerMode
                  ? 'Food Intake vs. Total Daily Burn (TDEE)' 
                  : isSensorConnected
                  ? `Food Intake vs. Total Daily Burn (${sensorName} + TEF)`
                  : 'Food Intake vs. Total Daily Burn (Tracker + TEF)'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-4 sm:my-5">
          {/* Calories Consumed */}
          <div className="bg-slate-950/60 border border-sky-500/20 rounded-2xl p-3 sm:p-3.5 text-center">
            <div className="text-[10px] sm:text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Calories In</div>
            <div className="text-xl sm:text-3xl font-black text-white mt-1">
              {totals.calories} <span className="text-[10px] sm:text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">Target: {goals.dailyCaloriesTarget}</div>
          </div>

          {/* Total Calories Burned */}
          <div 
            className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-3 sm:p-3.5 text-center"
            title={
              !isTrackerMode 
                ? `${burnBmr} kcal Rest + ${burnNeat} kcal NEAT + ${burnTef} kcal TEF + ${burnEat} kcal Exercise` 
                : `${burnEat} kcal ${sensorName} + ${burnTef} kcal TEF`
            }
          >
            <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Total Burned
            </div>
            <div className="text-xl sm:text-3xl font-black text-white mt-1">
              {totalBurned} <span className="text-[10px] sm:text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-emerald-400 mt-0.5 font-medium truncate">
              {!isTrackerMode 
                ? 'Rest + Active' 
                : `${sensorName} + TEF`}
            </div>
          </div>

          {/* Net Balance */}
          <div className={`border rounded-2xl p-3 sm:p-3.5 text-center ${
            isCaloricDeficit 
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}>
            <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Net Balance</div>
            <div className="text-xl sm:text-3xl font-black text-white mt-1 flex items-center justify-center gap-0.5">
              {netCalories > 0 ? `+${netCalories}` : netCalories} <span className="text-[10px] sm:text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[9px] sm:text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
              {isCaloricDeficit ? (
                <>
                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                  <span>Deficit</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                  <span>Surplus</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Visual Balance Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-slate-300 font-medium">
            <span>Intake: {totals.calories} kcal</span>
            <span>Total Burned: {totalBurned} kcal</span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-sky-400 transition-all duration-500"
              style={{ width: `${Math.min(50, (totals.calories / Math.max(1, totals.calories + totalBurned)) * 100)}%` }}
            />
            <div
              className="bg-emerald-400 transition-all duration-500 ml-auto"
              style={{ width: `${Math.min(50, (totalBurned / Math.max(1, totals.calories + totalBurned)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Segmented Workspace Navigation Bar (Daily Log | AI Coach | Trends & Health) */}
      <div className="flex items-center justify-center p-1 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-lg">
        <div className="grid grid-cols-3 w-full gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('log')}
            className={`py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all active:scale-95 ${
              activeTab === 'log'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Utensils className="w-4 h-4 shrink-0" />
            <span className="truncate">Daily Log</span>
            {summary.meals.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                activeTab === 'log' ? 'bg-cyan-700/80 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {summary.meals.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('coach')}
            className={`py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all active:scale-95 ${
              activeTab === 'coach'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="truncate">AI Coach</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('trends')}
            className={`py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all active:scale-95 ${
              activeTab === 'trends'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="truncate">Trends & Health</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DAILY LOG (Nutrition & Macros, Meals Timeline, Exercise Burn) */}
      {activeTab === 'log' && (
        <div className="space-y-5 animate-in fade-in duration-150">

      {/* 3. Daily Exercise & Energy Burn Breakdown Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{includeResting && !settings.healthConnectConnected ? 'Daily Energy Burn Breakdown (TDEE)' : 'Total Energy Burn (TDEE)'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  TDEE Model
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {includeResting && !settings.healthConnectConnected 
                  ? 'Resting metabolic rate, active movement, and food digestion' 
                  : settings.healthConnectConnected
                  ? 'Health Connect tracked burn (Rest + NEAT + Exercise) + dynamic TEF from logged nutrition'
                  : 'Combined resting, active, and food-induced thermogenesis'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={onOpenSettings}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-slate-800/80 min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95 transition"
            >
              {!isTrackerMode ? `Edit Profile (BMR: ${burnBmr} kcal)` : 'Settings (Fitness Tracker Mode)'}
            </button>
          </div>
        </div>

        {/* Sensor Live Sync Widget (Health Connect on Android) */}
        {settings.healthConnectConnected ? (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-2.5 px-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-emerald-300 truncate">Health Connect Connected</span>
                {onOpenDocumentation && (
                  <button
                    type="button"
                    onClick={() => onOpenDocumentation('fitness-tracker')}
                    className="text-slate-400 hover:text-emerald-300 p-0.5 rounded transition"
                    title="How fitness tracker sync works (Guide)"
                    aria-label="Fitness tracker sync guide"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {onSyncHealthConnect && (
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2.5 shrink-0">
                  {(activity.lastSyncedAt || settings.healthConnectLastSync) && (
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium whitespace-nowrap">
                      Last sync: {(() => {
                        const ts = activity.lastSyncedAt || settings.healthConnectLastSync;
                        if (!ts) return '';
                        const d = new Date(ts);
                        if (isNaN(d.getTime())) return '';
                        const isToday = d.toDateString() === new Date().toDateString();
                        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        return isToday ? timeStr : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
                      })()}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onSyncHealthConnect}
                    disabled={isSyncingHealthConnect}
                    className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold flex items-center space-x-1.5 min-h-[38px] py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 active:scale-95 transition disabled:opacity-50 shrink-0"
                    title="Sync latest calories burned from Health Connect"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHealthConnect ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isSyncingHealthConnect ? 'Syncing...' : 'Sync Health Connect'}</span>
                  </button>
                </div>
              )}
            </div>

            {isSensorConnected && (
              <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 gap-1">
                <span className="flex items-center gap-1">
                  <span>Burned so far:</span>
                  <span className="text-emerald-300 font-bold">{burnEat} kcal</span>
                  <span className="text-slate-500">({sensorActiveKcal} active + {sensorRestingKcal} rest)</span>
                </span>
                {activity.sensorProjectedTotal && activity.sensorProjectedTotal > burnEat && (
                  <span className="text-slate-400 font-medium">
                    24h est: <span className="text-amber-300/90 font-semibold">{activity.sensorProjectedTotal} kcal</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : isNativeAndroid && onConnectHealthConnect ? (
          <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 px-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-300">Auto-sync burn from Health Connect?</span>
            </div>
            <button
              type="button"
              onClick={onConnectHealthConnect}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1.5 min-h-[38px] py-1.5 px-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 hover:bg-emerald-900/50 active:scale-95 transition shadow-sm shrink-0"
            >
              <span>Connect Health Connect</span>
            </button>
          </div>
        ) : null}

        {/* Burn Display: 4-pillar breakdown (Rest + NEAT + TEF + Exercise) */}
        {!isTrackerMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              {/* 1. Rest (BMR) */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-amber-500/20">
                <span className="text-[10px] text-amber-400 font-semibold block uppercase tracking-wider">1. Rest (BMR)</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">{burnBmr} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-slate-400">Mifflin-St Jeor base</span>
              </div>

              {/* 2. NEAT */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-indigo-500/20">
                <span className="text-[10px] text-indigo-400 font-semibold block uppercase tracking-wider">2. NEAT</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">+{burnNeat} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-slate-400">Sedentary floor (15%)</span>
              </div>

              {/* 3. TEF */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-orange-500/20">
                <span className="text-[10px] text-orange-400 font-semibold block uppercase tracking-wider">3. TEF (Food)</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">+{burnTef} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-slate-400">From logged meals</span>
              </div>

              {/* 4. Exercise (EAT) */}
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/20">
                <span className="text-[10px] text-emerald-400 font-semibold block uppercase tracking-wider">4. Exercise (EAT)</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">+{burnEat} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-slate-400">{activity.workouts?.length ? `${activity.workouts.length} workout(s)` : 'Active burn'}</span>
              </div>
            </div>

            {/* Total Burned Formula Bar */}
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Total Daily Energy Expenditure (TDEE)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {burnBmr} (Rest) + {burnNeat} (NEAT) + {burnTef} (TEF) + {burnEat} (Exercise)
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xl font-black text-emerald-400 block">
                  {totalBurned} <span className="text-xs font-normal text-slate-400">kcal</span>
                </span>
                <span className="text-[10px] text-emerald-400/80 uppercase font-semibold">Total Burned Today</span>
              </div>
            </div>
          </div>
        ) : isSensorConnected ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
              <div
                className="bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/20 text-center w-full"
              >
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">1. {sensorName} Burn</span>
                </div>
                <span className="font-extrabold text-white text-base mt-0.5 block">{burnEat} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                
                {/* Active vs Resting Sub-breakdown */}
                <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] font-medium leading-none">
                  <span className="text-emerald-300">Active: {sensorActiveKcal}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-300/90">Rest: {sensorRestingKcal}</span>
                </div>

                <span className="text-[9px] text-slate-400 block mt-1">
                  {summary.date === getLocalDateString() ? 'Burned so far today' : 'Rest + NEAT + Exercise'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-orange-500/20">
                <span className="text-[10px] text-orange-400 font-semibold block uppercase tracking-wider">2. Thermic Effect (TEF)</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">+{burnTef} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-slate-400">Food digestion burn</span>
              </div>

              <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 font-semibold block uppercase tracking-wider">3. Total Burned (TDEE)</span>
                <span className="font-extrabold text-white text-base mt-0.5 block">{totalBurned} <span className="text-[10px] font-normal text-slate-400">kcal</span></span>
                <span className="text-[9px] text-emerald-400 font-medium">{sensorName} + TEF</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">External Tracker Burn + TEF</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {burnEat} (Tracker Burn) + {burnTef} (Food TEF)
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-emerald-400 block">
                {totalBurned} <span className="text-xs font-normal text-slate-400">kcal</span>
              </span>
              <span className="text-[10px] text-emerald-400/80">Total TDEE</span>
            </div>
          </div>
        )}

        {/* Input Field for Workout / Tracker Burn (Hidden when Tracker is active) */}
        {!isTrackerMode && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{includeResting ? 'Add Workout / Active Burn:' : 'Add Rest + Workout Burn:'}</span>
              </label>

              <button
                type="button"
                onClick={() => setIsVoiceWorkoutOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950 transition active:scale-95 shrink-0 self-start sm:self-auto"
                title="Describe your workout using voice and let Gemini estimate calories burnt"
              >
                <Mic className="w-3.5 h-3.5" />
                <Sparkles className="w-3 h-3 text-emerald-200" />
                <span>Voice Workout (AI)</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="number"
                  value={inputActiveKcal === '0' ? '' : inputActiveKcal}
                  placeholder={includeResting ? "e.g. 450 (or use Voice Workout above)" : "e.g. 2400 (from fitness tracker total burn)"}
                  onFocus={e => e.target.select()}
                  onChange={e => setInputActiveKcal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-base text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
                <span className="absolute right-4 top-3 text-xs font-semibold text-slate-400">
                  {includeResting ? 'active kcal' : 'total kcal'}
                </span>
              </div>

              <button
                onClick={() => handleSaveActiveBurn()}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-1.5 shadow-lg ${
                  isSavedRecently 
                    ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {isSavedRecently ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{includeResting ? 'Save Daily Burn' : 'Save Rest + Workout Burn'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick presets */}
            <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto">
              <span className="text-[11px] text-slate-400 mr-1 shrink-0">Quick add:</span>
              {(includeResting ? [200, 350, 500, 700, 900] : [1800, 2100, 2400, 2700, 3000]).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handlePresetClick(val)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700/80 transition shrink-0"
                >
                  {includeResting ? `+${val} kcal` : `${val} kcal`}
                </button>
              ))}
            </div>

            {/* Today's Logged Workouts List */}
            {activity.workouts && activity.workouts.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Workouts Logged Today ({activity.workouts.length})</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    Running Exercise Total: +{activity.workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0)} kcal
                  </span>
                </div>

                <div className="space-y-1.5">
                  {activity.workouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 px-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">{workout.title}</span>
                            {workout.durationMinutes && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                                <Clock className="w-2.5 h-2.5" />
                                {workout.durationMinutes}m
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5" title={workout.description}>
                            "{workout.description}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 ml-2">
                        <span className="text-xs font-black text-emerald-400">
                          +{workout.caloriesBurned} kcal
                        </span>
                        {onDeleteWorkout && (
                          <button
                            type="button"
                            onClick={() => onDeleteWorkout(workout.id)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                            title="Delete workout entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Nutrition, Fiber & Net Carbs Progress Bars */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span>Daily Nutrition & Macronutrients</span>
          </h3>
          <span className="text-xs text-slate-400">{totals.calories} / {goals.dailyCaloriesTarget} kcal</span>
        </div>
        
        <div className="grid sm:grid-cols-4 gap-3 pt-1">
          {/* Net Carbs & Total Carbs */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-cyan-300 font-bold">Net Carbs</span>
              <span className="text-slate-300">{totals.netCarbs}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, carbPercent)}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{totals.carbs}g Total Carbs</span>
              <span>{carbCalories} kcal</span>
            </div>
          </div>

          {/* Fiber */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-indigo-400 font-bold">Dietary Fiber</span>
              <span className="text-slate-300">{totals.fiber}g / {goals.dailyFiberTarget || 30}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, fiberPercent)}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{fiberPercent}% of target</span>
              <span>Gut Health</span>
            </div>
          </div>

          {/* Protein */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-rose-400 font-bold">Protein</span>
              <span className="text-slate-300">{totals.protein}g / {goals.dailyProteinTarget}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, proteinPercent)}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>{proteinPercent}% of goal</span>
              <span>{proteinCalories} kcal</span>
            </div>
          </div>

          {/* Fat with Dual-Tone Split Meter */}
          {(() => {
            const hasFatQuality = (totals.unsaturatedFat !== undefined && totals.unsaturatedFat > 0) || (totals.saturatedFat !== undefined && totals.saturatedFat > 0);
            const unsatGrams = totals.unsaturatedFat || 0;
            const satGrams = totals.saturatedFat || 0;
            const totalSplit = unsatGrams + satGrams;
            const unsatPct = totalSplit > 0 ? Math.round((unsatGrams / totalSplit) * 100) : (totals.fat > 0 ? 70 : 0);
            const satPct = totalSplit > 0 ? Math.round((satGrams / totalSplit) * 100) : (totals.fat > 0 ? 30 : 0);
            
            const target = goals.dailyFatTarget || 65;
            const totalWidth = Math.min(100, Math.max(0, (totals.fat / target) * 100));
            const unsatRatio = totalSplit > 0 ? (unsatGrams / totalSplit) : (totals.fat > 0 ? 0.7 : 0);
            const satRatio = totalSplit > 0 ? (satGrams / totalSplit) : (totals.fat > 0 ? 0.3 : 0);
            const unsatWidth = totalWidth * unsatRatio;
            const satWidth = totalWidth * satRatio;

            return (
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-amber-400 font-bold">Total Fat</span>
                  <span className="text-slate-300">{totals.fat}g / {goals.dailyFatTarget}g</span>
                </div>

                {hasFatQuality ? (
                  <div className="space-y-1.5">
                    {/* Dual-Tone Split Meter */}
                    <div 
                      className="h-2.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5"
                      title={`Healthy Unsaturated: ${unsatGrams}g (${unsatPct}%) | Saturated: ${satGrams}g (${satPct}%)`}
                    >
                      <div 
                        className={`h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ${satWidth > 0 ? 'rounded-l-full' : 'rounded-full'}`} 
                        style={{ width: `${Math.max(unsatWidth > 0 ? 3 : 0, unsatWidth)}%` }} 
                      />
                      <div 
                        className={`h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 ${unsatWidth > 0 ? 'rounded-r-full' : 'rounded-full'}`} 
                        style={{ width: `${Math.max(satWidth > 0 ? 3 : 0, satWidth)}%` }} 
                      />
                    </div>

                    {/* Sub-labels */}
                    <div className="text-[10px] flex justify-between items-center text-slate-400">
                      <span className="text-emerald-300 font-medium">● {unsatGrams}g Good <span className="text-slate-500">({unsatPct}%)</span></span>
                      <span className="text-amber-300 font-medium">● {satGrams}g Sat <span className="text-slate-500">({satPct}%)</span></span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, fatPercent)}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>{fatPercent}% of goal</span>
                      <span>{fatCalories} kcal</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Heart Health & Dietary Cholesterol Intake */}
        {(() => {
          const cholMg = totals.cholesterol || 0;
          const cholTarget = goals.dailyCholesterolTarget || 300;
          const cholPct = Math.round((cholMg / cholTarget) * 100);
          return (
            <div className="bg-slate-950/60 border border-violet-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-400 shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                    <span>Dietary Cholesterol Intake</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      cholPct > 100 
                        ? 'bg-rose-950/60 text-rose-300 border-rose-500/30' 
                        : 'bg-violet-950/60 text-violet-300 border-violet-500/30'
                    }`}>
                      {cholMg} mg / {cholTarget} mg guideline
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {cholPct > 100 
                      ? 'Exceeded standard daily dietary cholesterol ceiling (300 mg)' 
                      : `${cholPct}% of daily limit (${Math.max(0, cholTarget - cholMg)} mg remaining today)`}
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-48 shrink-0 space-y-1">
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      cholPct > 100 
                        ? 'bg-rose-400' 
                        : cholPct > 80 
                        ? 'bg-amber-400' 
                        : 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
                    }`} 
                    style={{ width: `${Math.min(100, cholPct)}%` }} 
                  />
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>{cholPct}% consumed</span>
                  <span className={cholPct > 100 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                    {cholPct > 100 ? 'Ceiling exceeded' : 'Within limit'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Dynamic Thermic Effect of Food (TEF) Breakdown */}
        <div className="bg-slate-950/60 border border-orange-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                <span>Thermic Effect of Food (TEF)</span>
                <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-950/60 px-1.5 py-0.5 rounded border border-orange-500/30">
                  +{burnTef} kcal burned
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Metabolic digestion cost: Protein (25%) • Carbs (8%) • Fat (2%)
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right text-[10px] text-slate-400 shrink-0 font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <span>P: {tefBreakdown.proteinTef} kcal • C: {tefBreakdown.carbsTef} kcal • F: {tefBreakdown.fatTef} kcal</span>
          </div>
        </div>
      </div>

          {/* Meals Timeline with Quick Favorites */}
          <MealHistory
            meals={summary.meals}
            favoriteMeals={favoriteMeals}
            yesterdayMeals={yesterdayMeals}
            onDeleteMeal={onDeleteMeal}
            onEditMeal={onEditMeal}
            onToggleFavorite={onToggleFavorite}
            onCopyMealToToday={onCopyMealToToday}
            onOpenCapture={onOpenCapture}
          />
        </div>
      )}

      {/* TAB 2: AI NUTRITION COACH */}
      {activeTab === 'coach' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <AICoachCard
            selectedDate={summary.date}
            summary={summary}
            settings={settings}
            historyData={historyData}
            weightHistory={weightHistory}
            lipidHistory={lipidHistory}
            onOpenSettings={onOpenSettings}
          />
        </div>
      )}

      {/* TAB 3: TRENDS & HEALTH BIOMETRICS */}
      {activeTab === 'trends' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <HistoryCharts
            historyData={historyData}
            weightHistory={weightHistory}
            lipidHistory={lipidHistory}
            isImperial={settings.profile.unitSystem === 'imperial'}
            includeResting={includeResting}
            calorieTarget={goals.dailyCaloriesTarget}
            proteinTarget={goals.dailyProteinTarget}
            cholesterolTarget={goals.dailyCholesterolTarget || 300}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeightTrackerCard
              currentDate={summary.date}
              weightRecord={summary.weightRecord}
              settings={settings}
              weightHistory={weightHistory}
              onSaveWeight={onSaveWeight}
            />
            <LipidTrackerCard
              lipidHistory={lipidHistory || []}
              onOpenModal={handleOpenLipidModal}
              userGender={settings.profile?.gender || 'male'}
            />
          </div>
        </div>
      )}

      {/* 7. Floating Action Button on Mobile with iOS Home Bar Safe Inset */}
      <div 
        className="fixed z-40"
        style={{
          bottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          right: 'max(20px, calc(env(safe-area-inset-right, 0px) + 16px))'
        }}
      >
        <button
          onClick={onOpenCapture}
          className="p-4 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold rounded-2xl shadow-2xl shadow-cyan-500/40 transition hover:scale-105 active:scale-95 flex items-center space-x-2"
          aria-label="Log meal"
        >
          <Camera className="w-6 h-6 stroke-[2.5]" />
          <span className="hidden sm:inline text-sm font-extrabold pr-1">Log Meal</span>
        </button>
      </div>

      {/* Voice Workout Modal - Only shown when no automated sensor is connected */}
      {!isSensorConnected && (
        <VoiceWorkoutModal
          isOpen={isVoiceWorkoutOpen}
          geminiApiKey={settings.geminiApiKey}
          profile={settings.profile}
          includeResting={includeResting}
          baseBmr={baseBmr}
          currentActiveKcal={activity.activeCaloriesBurned || 0}
          onSaveWorkout={(workout) => {
            if (onAddWorkout) {
              onAddWorkout(workout);
            } else {
              const newTotal = (activity.activeCaloriesBurned || 0) + workout.caloriesBurned;
              setInputActiveKcal(String(newTotal));
              handleSaveActiveBurn(newTotal);
            }
          }}
          onClose={() => setIsVoiceWorkoutOpen(false)}
        />
      )}

      {/* Lipid Tracker Modal */}
      {isLipidModalOpen && (
        <LipidTrackerModal
          isOpen={isLipidModalOpen}
          onClose={() => setIsLipidModalOpen(false)}
          lipidHistory={lipidHistory || []}
          onSaveRecord={onSaveLipidRecord || (() => {})}
          onDeleteRecord={onDeleteLipidRecord || (() => {})}
          userGender={settings.profile?.gender || 'male'}
          initialTab={lipidModalTab}
        />
      )}

    </div>
  );
};
