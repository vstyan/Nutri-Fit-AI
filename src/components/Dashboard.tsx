import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Camera, 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  PieChart,
  Activity,
  Plus
} from 'lucide-react';
import { 
  DailySummary, 
  AppSettings 
} from '../types';
import { MealHistory } from './MealHistory';
import { HistoryCharts } from './HistoryCharts';

interface DashboardProps {
  summary: DailySummary;
  settings: AppSettings;
  historyData: Array<{
    date: string;
    carbsIntake: number;
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }>;
  onOpenCapture: () => void;
  onDeleteMeal: (mealId: string) => void;
  onUpdateActiveBurn: (activeKcal: number) => void;
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  settings,
  historyData,
  onOpenCapture,
  onDeleteMeal,
  onUpdateActiveBurn,
  onOpenSettings
}) => {
  const { totals, activity } = summary;
  const { goals } = settings;

  const [inputActiveKcal, setInputActiveKcal] = useState<string>(
    activity.activeCaloriesBurned > 0 ? String(activity.activeCaloriesBurned) : ''
  );
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Sync local input state when date/activity changes
  useEffect(() => {
    setInputActiveKcal(activity.activeCaloriesBurned > 0 ? String(activity.activeCaloriesBurned) : '');
  }, [activity.activeCaloriesBurned, summary.date]);

  const activeKcalValue = Number(inputActiveKcal) || 0;
  const baseBmr = activity.baseBmrCalories || 1700;
  const totalBurned = baseBmr + activeKcalValue;
  const netCalories = totals.calories - totalBurned;
  const isCaloricDeficit = netCalories <= 0;

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
  const proteinPercent = Math.min(Math.round((totals.protein / (goals.dailyProteinTarget || 140)) * 100), 150);
  const fatPercent = Math.min(Math.round((totals.fat / (goals.dailyFatTarget || 65)) * 100), 150);

  const carbCalories = Math.round(totals.carbs * 4);
  const proteinCalories = Math.round(totals.protein * 4);
  const fatCalories = Math.round(totals.fat * 9);

  return (
    <div className="space-y-5 pb-24 max-w-4xl mx-auto px-4 pt-4">
      {/* 1. Hero Card: Calories In vs. Calories Burned */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Daily Caloric Balance</h2>
              <p className="text-xs text-slate-400">Food Intake vs. Total Daily Burn (Base BMR + Exercise)</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 my-5">
          {/* Calories Consumed */}
          <div className="bg-slate-950/60 border border-sky-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Calories In</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totals.calories} <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Target: {goals.dailyCaloriesTarget} kcal</div>
          </div>

          {/* Total Calories Burned */}
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Total Burned</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {totalBurned} <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">{baseBmr} base + {activeKcalValue} active</div>
          </div>

          {/* Net Balance */}
          <div className={`border rounded-2xl p-3.5 text-center ${
            isCaloricDeficit 
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider">Net Balance</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center justify-center gap-0.5">
              {netCalories > 0 ? `+${netCalories}` : netCalories} <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[10px] font-medium mt-1 flex items-center justify-center gap-1">
              {isCaloricDeficit ? (
                <>
                  <TrendingDown className="w-3 h-3 text-emerald-400" />
                  <span>Caloric Deficit</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-amber-400" />
                  <span>Caloric Surplus</span>
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

      {/* 2. Enhanced Exercise & Active Burn Logger Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Daily Energy Burn Breakdown</h3>
              <p className="text-xs text-slate-400">Natural BMR baseline + additional workout/activity burn</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={onOpenSettings}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 transition"
            >
              Edit Profile (BMR: {baseBmr} kcal)
            </button>
          </div>
        </div>

        {/* Base BMR vs Active Equation Display */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">1. Natural Base (BMR)</span>
            <span className="font-bold text-amber-400 text-sm mt-0.5 block">{baseBmr} kcal</span>
            <span className="text-[9px] text-slate-500">Auto from profile</span>
          </div>

          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">2. Exercise / Steps</span>
            <span className="font-bold text-emerald-400 text-sm mt-0.5 block">+{activeKcalValue} kcal</span>
            <span className="text-[9px] text-slate-500">Entered by you</span>
          </div>

          <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
            <span className="text-[10px] text-emerald-300 block">3. Total Burned</span>
            <span className="font-extrabold text-white text-sm mt-0.5 block">{totalBurned} kcal</span>
            <span className="text-[9px] text-emerald-400">Sum for today</span>
          </div>
        </div>

        {/* Input Field for Active Workout Burn */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Add Additional Exercise / Active Burn:</span>
            <span className="text-[11px] text-slate-400">Total: {totalBurned} kcal</span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="number"
                value={inputActiveKcal}
                onChange={e => setInputActiveKcal(e.target.value)}
                placeholder="e.g. 450 (walking, workout, running)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-base text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
              <span className="absolute right-4 top-3 text-xs font-semibold text-slate-400">active kcal</span>
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
                  <span>Save Exercise</span>
                </>
              )}
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto">
            <span className="text-[11px] text-slate-400 mr-1 shrink-0">Quick add:</span>
            {[200, 350, 500, 700, 900].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handlePresetClick(val)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700/80 transition shrink-0"
              >
                +{val} kcal
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Nutrition & Macro Target Progress Bars */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-cyan-400" />
            <span>Daily Nutrition & Macronutrients</span>
          </h3>
          <span className="text-xs text-slate-400">{totals.calories} / {goals.dailyCaloriesTarget} kcal</span>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-4 pt-1">
          {/* Carbs */}
          <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-sky-400 font-bold">Carbohydrates</span>
              <span className="text-slate-300">{totals.carbs}g / {goals.dailyCarbsTarget}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, carbPercent)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>{carbPercent}% of goal</span>
              <span>{carbCalories} kcal</span>
            </div>
          </div>

          {/* Protein */}
          <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-rose-400 font-bold">Protein</span>
              <span className="text-slate-300">{totals.protein}g / {goals.dailyProteinTarget}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, proteinPercent)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>{proteinPercent}% of goal</span>
              <span>{proteinCalories} kcal</span>
            </div>
          </div>

          {/* Fat */}
          <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-amber-400 font-bold">Fat</span>
              <span className="text-slate-300">{totals.fat}g / {goals.dailyFatTarget}g</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, fatPercent)}%` }} />
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>{fatPercent}% of goal</span>
              <span>{fatCalories} kcal</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Meals Timeline */}
      <MealHistory
        meals={summary.meals}
        onDeleteMeal={onDeleteMeal}
        onOpenCapture={onOpenCapture}
      />

      {/* 5. Weekly Comparison Chart */}
      <HistoryCharts
        historyData={historyData}
      />

      {/* 6. Sticky Floating Photo Button on Mobile */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={onOpenCapture}
          className="p-4 bg-gradient-to-tr from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold rounded-2xl shadow-2xl shadow-cyan-500/40 transition hover:scale-105 active:scale-95 flex items-center space-x-2"
          aria-label="Log meal"
        >
          <Camera className="w-6 h-6 stroke-[2.5]" />
          <span className="hidden sm:inline text-sm font-extrabold pr-1">Log Meal</span>
        </button>
      </div>
    </div>
  );
};
