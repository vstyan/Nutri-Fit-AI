import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Scale, 
  Utensils, 
  RefreshCw, 
  CheckCircle2, 
  Lightbulb, 
  Calendar,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Info,
  Flame,
  Zap,
  Target,
  Dumbbell,
  Activity
} from 'lucide-react';
import { 
  DailyCoachInsight, 
  WeeklyCoachInsight, 
  DailySummary, 
  AppSettings, 
  MealRecord, 
  WeightRecord, 
  BloodLipidRecord,
  HistoryDayRecord
} from '../types';
import { 
  buildDailyCoachPayload, 
  buildWeeklyCoachPayload 
} from '../utils/coachAggregator';
import { 
  generateDailyCoachInsight, 
  generateWeeklyCoachInsight 
} from '../services/geminiService';
import { 
  getCachedDailyInsight, 
  saveCachedDailyInsight, 
  clearCachedDailyInsight,
  getCachedWeeklyInsight, 
  saveCachedWeeklyInsight, 
  clearCachedWeeklyInsight,
  getMealsForDate
} from '../services/storageService';
import { getLocalDateString } from '../utils/dateUtils';

interface AICoachCardProps {
  selectedDate: string;
  summary: DailySummary;
  settings: AppSettings;
  historyData: HistoryDayRecord[];
  weightHistory?: WeightRecord[];
  lipidHistory?: BloodLipidRecord[];
  onOpenSettings?: () => void;
}

export const AICoachCard: React.FC<AICoachCardProps> = ({
  selectedDate,
  summary,
  settings,
  historyData,
  weightHistory = [],
  lipidHistory = [],
  onOpenSettings
}) => {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [dailyInsight, setDailyInsight] = useState<DailyCoachInsight | null>(null);
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyCoachInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Compute a week key for caching weekly insights (e.g., "2026-W39")
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  const weekKey = getWeekKey(selectedDate);
  const dateRangeStr = historyData.length > 0
    ? `${historyData[0].date} – ${historyData[historyData.length - 1].date}`
    : selectedDate;
  const isToday = selectedDate === getLocalDateString();

  // Load cached insight whenever selected date or tab changes
  useEffect(() => {
    let isMounted = true;
    setError(null);

    const loadCached = async () => {
      if (tab === 'daily') {
        const cached = await getCachedDailyInsight(selectedDate);
        if (isMounted) setDailyInsight(cached);
      } else {
        const cached = await getCachedWeeklyInsight(weekKey);
        if (isMounted) setWeeklyInsight(cached);
      }
    };

    loadCached();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, tab, weekKey]);

  // Loading animation message cycle
  useEffect(() => {
    if (!isLoading) return;
    const steps = [
      'Analyzing chrono-nutrition & meal timing windows...',
      'Evaluating workouts, active burn & athletic recovery...',
      'Aligning recommendations with your top diet & fitness goals...',
      'Formulating tailored whole food prescriptions...'
    ];
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % steps.length);
    }, 2400);

    return () => clearInterval(interval);
  }, [isLoading]);

  const scrollToCardTop = () => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const headerOffset = 85; // Clearance for sticky app header + mobile safe-area
    // Only scroll if the top of the card is obscured behind the sticky header or scrolled far below
    if (rect.top < headerOffset || rect.top > window.innerHeight) {
      const targetY = window.scrollY + rect.top - headerOffset;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  };

  const handleGenerateDaily = async (forceRefresh = false) => {
    if (!settings.geminiApiKey) {
      setError('Please add your Gemini API Key in Settings to enable AI Coaching.');
      return;
    }

    if (summary.meals.length === 0) {
      setError('Log at least one meal today to generate your daily AI coaching insight.');
      return;
    }

    // Ensure card header stays properly framed without being cut off under sticky header
    scrollToCardTop();
    setIsLoading(true);
    setError(null);

    try {
      if (forceRefresh) {
        await clearCachedDailyInsight(selectedDate);
      }

      const payload = buildDailyCoachPayload(
        selectedDate,
        summary,
        settings,
        historyData,
        weightHistory,
        lipidHistory
      );

      const result = await generateDailyCoachInsight(payload, settings.geminiApiKey);
      await saveCachedDailyInsight(selectedDate, result);
      setDailyInsight(result);
    } catch (err: any) {
      console.error('Error generating daily coach insight:', err);
      setError(err.message || 'Failed to generate daily insight. Please check your connection or API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateWeekly = async (forceRefresh = false) => {
    if (!settings.geminiApiKey) {
      setError('Please add your Gemini API Key in Settings to enable AI Coaching.');
      return;
    }

    if (historyData.length < 2) {
      setError('At least 2 days of logs are needed to extract weekly patterns.');
      return;
    }

    scrollToCardTop();
    setIsLoading(true);
    setError(null);

    try {
      if (forceRefresh) {
        await clearCachedWeeklyInsight(weekKey);
      }

      // Fetch meal records for recent days to feed into weekly aggregator
      const mealsByDate: Record<string, MealRecord[]> = {};
      for (const h of historyData) {
        mealsByDate[h.date] = await getMealsForDate(h.date, settings);
      }

      const payload = buildWeeklyCoachPayload(
        weekKey,
        dateRangeStr,
        historyData,
        mealsByDate,
        settings,
        weightHistory,
        lipidHistory
      );

      const result = await generateWeeklyCoachInsight(payload, settings.geminiApiKey);
      await saveCachedWeeklyInsight(weekKey, result);
      setWeeklyInsight(result);
    } catch (err: any) {
      console.error('Error generating weekly coach insight:', err);
      setError(err.message || 'Failed to generate weekly insight. Please check your connection or API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadingMessages = [
    'Analyzing chrono-nutrition & meal timing windows...',
    'Evaluating workouts, active burn & athletic recovery...',
    'Aligning recommendations with your top diet & fitness goals...',
    'Formulating tailored whole food prescriptions...'
  ];

  return (
    <div ref={cardRef} className="scroll-mt-20 sm:scroll-mt-24 bg-slate-900/95 border border-indigo-500/25 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-sm min-h-[220px]">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Card Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0 shadow-inner">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">NutriFit AI Coach</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Deep Insights
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Chrono-nutrition, hidden trend discovery, and compensatory planning
            </p>
          </div>
        </div>

        {/* Controls: Tab Selector & Top Re-Analyze Action */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2">
          {/* Tab Selector Buttons */}
          <div className="flex-1 sm:flex-initial flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setTab('daily')}
              className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[70px] sm:min-w-[85px] ${
                tab === 'daily'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Today's Coach
            </button>
            <button
              type="button"
              onClick={() => setTab('weekly')}
              className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[70px] sm:min-w-[85px] ${
                tab === 'weekly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Weekly Report
            </button>
          </div>

          {/* Top Re-Analyze Button */}
          {((tab === 'daily' && !!dailyInsight) || (tab === 'weekly' && !!weeklyInsight)) && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => (tab === 'daily' ? handleGenerateDaily(true) : handleGenerateWeekly(true))}
              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 active:scale-95 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 shadow-sm disabled:opacity-50"
              title={tab === 'daily' ? "Re-analyze today's nutrition and timing" : "Re-analyze 7-day multi-day patterns"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing...' : 'Re-analyze'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active User Goals Bar */}
      {settings.goals.primaryGoals && settings.goals.primaryGoals.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pb-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Target Goals:</span>
          </span>
          {settings.goals.primaryGoals.map((goal, idx) => (
            <span
              key={idx}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm"
            >
              <span>🎯 {goal}</span>
            </span>
          ))}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[10px] text-slate-400 hover:text-cyan-300 underline font-medium ml-1 transition"
            >
              Edit
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Set your top 3 diet &amp; fitness goals in Settings so AI Coach can personalize all insights.</span>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline shrink-0 ml-2"
            >
              Set Goals &rarr;
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 flex items-center justify-between gap-2">
            <span>{error}</span>
            {error.includes('Settings') && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs underline text-rose-300 hover:text-white font-medium shrink-0"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Re-Analysis Progress Banner (Always visible at top of card, never blanks page) */}
      {isLoading && ((tab === 'daily' && !!dailyInsight) || (tab === 'weekly' && !!weeklyInsight)) && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center space-x-3 animate-in fade-in duration-200">
          <div className="relative shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-2.5 h-2.5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-indigo-400">
                {tab === 'daily' ? "Updating Today's AI Coaching Insight..." : "Updating 7-Day Performance Insight..."}
              </span>
              <span className="text-[10px] text-indigo-300 font-mono">Live</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {loadingMessages[loadingStep]}
            </p>
          </div>
        </div>
      )}

      {/* Standalone Loading Box when generating for the first time without cached content */}
      {isLoading && ((tab === 'daily' && !dailyInsight) || (tab === 'weekly' && !weeklyInsight)) && (
        <div className="min-h-[280px] p-8 border border-indigo-500/20 bg-slate-950/60 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
            <Sparkles className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Generating AI Coach Analysis</p>
            <p className="text-xs text-indigo-300/90 mt-1 transition-opacity duration-300">
              {loadingMessages[loadingStep]}
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: DAILY INSIGHT */}
      {(!isLoading || !!dailyInsight) && tab === 'daily' && (
        <>
          {!dailyInsight ? (
            <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-sm font-bold text-slate-200">Ready to Analyze Today's Nutrition & Timing</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Examine your meal eating windows, chrono-nutrition impact, subtle weekend/weekday trends, and get custom food solutions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateDaily(false)}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center space-x-2 shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analyze Today</span>
              </button>
            </div>
          ) : (
            <div className={`space-y-3.5 transition-opacity duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {/* Diagnosis Headline & Adherence Pill */}
              <div className="p-3.5 bg-slate-950/80 border border-indigo-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Diagnosis</span>
                    {isToday && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Live Pacing
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-100 leading-snug">
                    "{dailyInsight.headline}"
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <div className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-indigo-300 font-extrabold text-xs">
                    Score: {dailyInsight.adherenceScore}/100
                  </div>
                </div>
              </div>

              {/* 1. Chrono-Nutrition & Meal Timing Window */}
              <div className="p-3.5 bg-slate-950/70 border border-purple-500/25 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-purple-300 text-xs font-bold">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>Chrono-Nutrition & Eating Window</span>
                  </div>
                  {dailyInsight.chronoNutrition.eatingWindowHours !== undefined && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                      {isToday ? `Window so far: ${dailyInsight.chronoNutrition.eatingWindowHours} hrs` : `Window: ${dailyInsight.chronoNutrition.eatingWindowHours} hrs`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {dailyInsight.chronoNutrition.firstMealTime && (
                    <span className="px-2 py-0.5 bg-purple-950/60 text-purple-300 rounded border border-purple-500/20 text-[11px]">
                      First: <span className="font-bold text-white">{dailyInsight.chronoNutrition.firstMealTime}</span>
                    </span>
                  )}
                  {dailyInsight.chronoNutrition.lastMealTime && (
                    <span className="px-2 py-0.5 bg-purple-950/60 text-purple-300 rounded border border-purple-500/20 text-[11px]">
                      {isToday ? 'Latest: ' : 'Last: '}<span className="font-bold text-white">{dailyInsight.chronoNutrition.lastMealTime}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {dailyInsight.chronoNutrition.timingDiagnosis}
                </p>

                <div className="pt-2 border-t border-slate-800/80 flex items-start space-x-2 text-xs text-slate-300 leading-relaxed">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white font-semibold">
                      {isToday ? "Today's Timing Strategy:" : "Timing Tweak for Tomorrow:"}
                    </strong>{' '}
                    <span>{dailyInsight.chronoNutrition.actionableAdjustment}</span>
                  </span>
                </div>
              </div>

              {/* 2. Workout Fueling & Athletic Recovery */}
              {dailyInsight.workoutAnalysis && (
                <div className={`p-3.5 bg-slate-950/70 rounded-xl space-y-2.5 border transition ${
                  dailyInsight.workoutAnalysis.workoutDetected
                    ? 'border-orange-500/35'
                    : 'border-slate-800'
                }`}>
                  {/* Card Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2 text-xs font-bold text-orange-400">
                      <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Workout Fueling &amp; Athletic Recovery</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase ${
                      dailyInsight.workoutAnalysis.workoutDetected
                        ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}>
                      {dailyInsight.workoutAnalysis.workoutDetected ? '🔥 Active Workout Day' : '🛌 Rest / Recovery'}
                    </span>
                  </div>

                  {/* Activity Highlight Box (Clean rectangular callout with left accent) */}
                  {dailyInsight.workoutAnalysis.activitySummary && (
                    <div className={`rounded-xl border p-3 ${
                      dailyInsight.workoutAnalysis.workoutDetected
                        ? 'border-orange-500/25 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-950/30 via-slate-900/60 to-slate-900/40 text-slate-200'
                        : 'border-slate-800 border-l-4 border-l-slate-600 bg-slate-900/60 text-slate-300'
                    }`}>
                      <div className="flex items-center space-x-2 text-[11px] font-bold text-orange-300 mb-1.5">
                        <Activity className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>
                          {dailyInsight.workoutAnalysis.workoutDetected ? 'Recorded Physical Activity' : 'Daily Movement Baseline'}
                        </span>
                      </div>

                      {dailyInsight.workoutAnalysis.activitySummary.includes(';') ? (
                        <div className="space-y-2 mt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {dailyInsight.workoutAnalysis.activitySummary
                              .split(';')
                              .map((part, idx) => {
                                const cleanPart = part
                                  .replace(/^Dedicated workouts logged:\s*/i, '')
                                  .replace(/\(Total dedicated workout burn:.*$/i, '')
                                  .trim();
                                if (!cleanPart) return null;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-slate-950/70 border border-orange-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 flex items-start space-x-2 shadow-sm"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                                    <span className="leading-snug font-medium">{cleanPart}</span>
                                  </div>
                                );
                              })}
                          </div>
                          {dailyInsight.workoutAnalysis.activitySummary.includes('Total dedicated workout burn') && (
                            <div className="pt-1 flex flex-wrap items-center justify-between text-[11px] text-orange-300/90 font-medium border-t border-orange-500/15">
                              <span>
                                {dailyInsight.workoutAnalysis.activitySummary.match(/\(Total dedicated workout burn:.*?\)/i)?.[0]?.replace(/[()]/g, '') || ''}
                              </span>
                              <span>
                                {dailyInsight.workoutAnalysis.activitySummary.match(/Total day expenditure.*$/i)?.[0] || ''}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-200 leading-relaxed font-medium">
                          {dailyInsight.workoutAnalysis.activitySummary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Encouragement / Workout Praise */}
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {dailyInsight.workoutAnalysis.encouragement}
                  </p>

                  {/* Dietary Adjustment & Fueling Advice */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-start space-x-2 text-xs text-slate-300 leading-relaxed">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white font-semibold">Dietary Fueling Adjustment:</strong>{' '}
                      <span>{dailyInsight.workoutAnalysis.fuelingAdvice}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Hidden Behavioral Pattern Detected */}
              <div className="p-3.5 bg-slate-950/70 border border-amber-500/25 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Pattern Discovery: {dailyInsight.patternDiscovery.patternTitle}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {dailyInsight.patternDiscovery.observation}
                </p>
                {dailyInsight.patternDiscovery.underlyingDriver && (
                  <p className="text-[11px] text-slate-400 italic">
                    Root Cause: {dailyInsight.patternDiscovery.underlyingDriver}
                  </p>
                )}
              </div>

              {/* 4. Compensatory Rebalance Plan */}
              <div className="p-3.5 bg-slate-950/70 border border-emerald-500/25 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>Compensatory Rebalancing Plan</span>
                </div>
                <p className="text-xs font-semibold text-white">
                  {dailyInsight.rebalancePlan.headline}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {dailyInsight.rebalancePlan.dailyMicroAdjustment}
                </p>
              </div>

              {/* 5. Prescriptive Whole Food Solutions */}
              {dailyInsight.recommendedFoods.length > 0 && (
                <div className="p-3.5 bg-slate-950/70 border border-sky-500/25 rounded-xl space-y-2.5">
                  <div className="flex items-center space-x-2 text-sky-300 text-xs font-bold">
                    <Utensils className="w-4 h-4 text-sky-400" />
                    <span>Prescriptive Whole Food Recommendations</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {dailyInsight.recommendedFoods.map((food, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{food.foodName}</span>
                          <span className="text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/20 font-medium">
                            {food.bestTiming}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {food.portionSuggestion}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          ⚡ {food.targetBenefit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Info */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Updated: {new Date(dailyInsight.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[10px] text-slate-400 font-medium">NutriFit Intelligence</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: WEEKLY DEEP DIVE */}
      {(!isLoading || !!weeklyInsight) && tab === 'weekly' && (
        <>
          {!weeklyInsight ? (
            <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-sm font-bold text-slate-200">7-Day Multi-Day Performance Deep Dive</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Examine weekly adherence, weekday vs weekend variances, rolling cumulative energy balance, and strategy for next week.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGenerateWeekly(false)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all flex items-center space-x-2 shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Weekly Report</span>
              </button>
            </div>
          ) : (
            <div className={`space-y-3.5 transition-opacity duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {/* Executive Diagnosis & Score */}
              <div className="p-3.5 bg-slate-950/80 border border-purple-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Executive Summary</span>
                    <span className="text-[10px] text-slate-500 font-medium">({weeklyInsight.dateRange})</span>
                  </div>
                  <p className="text-sm font-bold text-slate-100 leading-snug">
                    "{weeklyInsight.executiveDiagnosis}"
                  </p>
                </div>
                <div className="px-3 py-1 bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-300 font-extrabold text-xs shrink-0 self-end sm:self-center">
                  Weekly Score: {weeklyInsight.weeklyScore}/100
                </div>
              </div>

              {/* 1. Metabolic Trajectory & Energy Balance */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-medium">Avg Consumed</span>
                  <p className="text-sm font-bold text-cyan-300 mt-0.5">
                    {weeklyInsight.metabolicTrajectory.avgDailyConsumed.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">kcal/d</span>
                  </p>
                </div>
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-medium">Avg Burned</span>
                  <p className="text-sm font-bold text-emerald-300 mt-0.5">
                    {weeklyInsight.metabolicTrajectory.avgDailyBurned.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">kcal/d</span>
                  </p>
                </div>
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-medium">Net Week Balance</span>
                  <p className={`text-sm font-bold mt-0.5 ${
                    weeklyInsight.metabolicTrajectory.weeklyNetCalories < 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {weeklyInsight.metabolicTrajectory.weeklyNetCalories > 0 ? `+${weeklyInsight.metabolicTrajectory.weeklyNetCalories.toLocaleString()}` : weeklyInsight.metabolicTrajectory.weeklyNetCalories.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">kcal</span>
                  </p>
                </div>
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-medium">Projected Shift</span>
                  <p className="text-sm font-bold text-purple-300 mt-0.5 truncate">
                    {weeklyInsight.metabolicTrajectory.projectedWeightShift}
                  </p>
                </div>
              </div>

              {/* 2. Top Weekly Patterns Discovered */}
              {weeklyInsight.topPatternsDetected.length > 0 && (
                <div className="p-3.5 bg-slate-950/70 border border-amber-500/25 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    <span>Behavioral Patterns & Weekday/Weekend Variance</span>
                  </div>
                  <div className="space-y-2">
                    {weeklyInsight.topPatternsDetected.map((p, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <span className="text-xs font-semibold text-white">• {p.patternTitle}:</span>
                        <p className="text-xs text-slate-300 pl-3 leading-relaxed">{p.observation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Chrono-Nutrition & Window Consistency */}
              <div className="p-3.5 bg-slate-950/70 border border-purple-500/25 rounded-xl space-y-1.5">
                <div className="flex items-center space-x-2 text-purple-300 text-xs font-bold">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>Weekly Meal Timing & Chrono Rhythm</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {weeklyInsight.chronoPatternTrends}
                </p>
              </div>

              {/* 4. Strategic Next Week Game Plan */}
              <div className="p-3.5 bg-slate-950/70 border border-emerald-500/25 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-300 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Next Week Strategy: {weeklyInsight.weeklyRebalanceStrategy.focusArea}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {weeklyInsight.weeklyRebalanceStrategy.actionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Food Staples to Prioritize */}
              {weeklyInsight.recommendedFoods.length > 0 && (
                <div className="p-3.5 bg-slate-950/70 border border-sky-500/25 rounded-xl space-y-2.5">
                  <div className="flex items-center space-x-2 text-sky-300 text-xs font-bold">
                    <Utensils className="w-4 h-4 text-sky-400" />
                    <span>Weekly Staples to Stock & Meal Prep</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {weeklyInsight.recommendedFoods.map((food, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{food.foodName}</span>
                          <span className="text-[10px] text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/20 font-medium">
                            {food.bestTiming}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {food.portionSuggestion}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          ⚡ {food.targetBenefit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Info */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                <span>Generated: {new Date(weeklyInsight.generatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                <span className="text-[10px] text-slate-400 font-medium">NutriFit Intelligence</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Google Gemini AI Accuracy Disclaimer */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-center text-center px-2">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 flex-wrap leading-tight">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Gemini can make mistakes, so always double-check data and recommendations.</span>
        </p>
      </div>
    </div>
  );
};
