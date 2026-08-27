import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Camera, 
  Zap, 
  TrendingDown, 
  TrendingUp, 
  Check, 
  PieChart 
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
  onUpdateCaloriesBurned: (kcal: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  settings,
  historyData,
  onOpenCapture,
  onDeleteMeal,
  onUpdateCaloriesBurned
}) => {
  const { totals, activity } = summary;
  const { goals } = settings;

  const [inputCaloriesBurned, setInputCaloriesBurned] = useState<string>(
    activity.caloriesBurned > 0 ? String(activity.caloriesBurned) : ''
  );
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Sync local input state when date/activity changes
  useEffect(() => {
    setInputCaloriesBurned(activity.caloriesBurned > 0 ? String(activity.caloriesBurned) : '');
  }, [activity.caloriesBurned, summary.date]);

  const caloriesBurnedValue = Number(inputCaloriesBurned) || 0;
  const netCalories = totals.calories - caloriesBurnedValue;
  const isCaloricDeficit = netCalories <= 0;

  const handleSaveCaloriesBurned = (valToSave?: number) => {
    const finalVal = valToSave !== undefined ? valToSave : (Number(inputCaloriesBurned) || 0);
    onUpdateCaloriesBurned(finalVal);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 1500);
  };

  const handlePresetClick = (preset: number) => {
    setInputCaloriesBurned(String(preset));
    handleSaveCaloriesBurned(preset);
  };

  const calPercent = Math.min(Math.round((totals.calories / (goals.dailyCaloriesTarget || 2000)) * 100), 150);
  const carbPercent = Math.min(Math.round((totals.carbs / (goals.dailyCarbsTarget || 200)) * 100), 150);
  const proteinPercent = Math.min(Math.round((totals.protein / (goals.dailyProteinTarget || 140)) * 100), 150);
  const fatPercent = Math.min(Math.round((totals.fat / (goals.dailyFatTarget || 65)) * 100), 150);

  // Macro calorie contributions
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
              <p className="text-xs text-slate-400">Diet Calories Consumed vs. Fitness Calories Burned</p>
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

          {/* Calories Burned */}
          <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Calories Burned</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              {caloriesBurnedValue} <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">From fitness tracker</div>
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
            <span>Burned: {caloriesBurnedValue} kcal</span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-sky-400 transition-all duration-500"
              style={{ width: `${Math.min(50, (totals.calories / Math.max(1, totals.calories + caloriesBurnedValue)) * 100)}%` }}
            />
            <div
              className="bg-emerald-400 transition-all duration-500 ml-auto"
              style={{ width: `${Math.min(50, (caloriesBurnedValue / Math.max(1, totals.calories + caloriesBurnedValue)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. End-of-Day Calories Burned Entry Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Log Calories Burned Today</h3>
            <p className="text-xs text-slate-400">Enter total calories burned from your fitness tracker / smartwatch</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <input
              type="number"
              value={inputCaloriesBurned}
              onChange={e => setInputCaloriesBurned(e.target.value)}
              placeholder="e.g. 2100"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-base text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
            <span className="absolute right-4 top-3 text-xs font-semibold text-slate-400">kcal</span>
          </div>

          <button
            onClick={() => handleSaveCaloriesBurned()}
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
                <span>Save Burned</span>
              </>
            )}
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto">
          <span className="text-[11px] text-slate-400 mr-1 shrink-0">Quick presets:</span>
          {[1600, 1800, 2000, 2200, 2500, 2800].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => handlePresetClick(val)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700/80 transition shrink-0"
            >
              {val} kcal
            </button>
          ))}
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
          aria-label="Snap food photo"
        >
          <Camera className="w-6 h-6 stroke-[2.5]" />
          <span className="hidden sm:inline text-sm font-extrabold pr-1">Log Food Photo</span>
        </button>
      </div>
    </div>
  );
};
