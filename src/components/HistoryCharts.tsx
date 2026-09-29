import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Scale, Zap, Wheat, Flame, Heart } from 'lucide-react';
import { WeightRecord, BloodLipidRecord } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HistoryChartsProps {
  historyData: Array<{
    date: string;
    carbsIntake: number;
    fiberIntake?: number;
    netCarbsIntake?: number;
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }>;
  weightHistory?: WeightRecord[];
  lipidHistory?: BloodLipidRecord[];
  isImperial?: boolean;
  includeResting?: boolean;
}

export const HistoryCharts: React.FC<HistoryChartsProps> = ({
  historyData,
  weightHistory = [],
  lipidHistory = [],
  isImperial = true,
  includeResting = true
}) => {
  const [metric, setMetric] = useState<'calories' | 'carbs' | 'weight' | 'lipids'>('calories');

  const labels = historyData.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

  // 7-Day Averages & Weekly Balance Calculations
  const totalBurned = historyData.reduce((sum, d) => sum + (d.caloriesBurned || 0), 0);
  const avgBurned = historyData.length > 0 ? Math.round(totalBurned / historyData.length) : 0;

  const loggedDays = historyData.filter(d => (d.caloriesIntake || 0) > 0);
  const loggedDaysCount = loggedDays.length;
  const totalConsumed = loggedDays.reduce((sum, d) => sum + (d.caloriesIntake || 0), 0);
  const avgConsumed = loggedDaysCount > 0 ? Math.round(totalConsumed / loggedDaysCount) : 0;

  // Net difference per day (Consumed - Burned)
  // Negative means Deficit (Burned > Consumed), Positive means Surplus (Consumed > Burned)
  const netDaily = avgConsumed > 0 ? (avgConsumed - avgBurned) : 0;
  const isDeficit = netDaily < 0;
  const isSurplus = netDaily > 0;

  // Projected weekly weight change (approx. 3,500 kcal per lb of fat, 7,700 kcal per kg)
  const estWeeklyWeight = avgConsumed > 0 && Math.abs(netDaily) >= 25
    ? isImperial
      ? (Math.abs(netDaily) * 7 / 3500).toFixed(1)
      : (Math.abs(netDaily) * 7 / 7700).toFixed(1)
    : null;

  // Net carbs & macro averages
  const carbLoggedDays = historyData.filter(d => (d.carbsIntake || 0) > 0);
  const carbDaysCount = carbLoggedDays.length > 0 ? carbLoggedDays.length : 1;
  const avgNetCarbs = Math.round(historyData.reduce((sum, d) => sum + (d.netCarbsIntake ?? d.carbsIntake ?? 0), 0) / carbDaysCount * 10) / 10;
  const avgTotalCarbs = Math.round(historyData.reduce((sum, d) => sum + (d.carbsIntake || 0), 0) / carbDaysCount * 10) / 10;
  const avgFiber = Math.round(historyData.reduce((sum, d) => sum + (d.fiberIntake || 0), 0) / carbDaysCount * 10) / 10;

  // Calorie and Carb datasets
  const barChartData = {
    labels,
    datasets: metric === 'calories'
      ? [
          {
            label: 'Calories Consumed (kcal)',
            data: historyData.map(d => d.caloriesIntake),
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Total Calories Burned (kcal)',
            data: historyData.map(d => d.caloriesBurned),
            backgroundColor: 'rgba(52, 211, 153, 0.75)',
            borderColor: '#34d399',
            borderWidth: 1.5,
            borderRadius: 6,
          }
        ]
      : [
          {
            label: 'Total Carbs (g)',
            data: historyData.map(d => d.carbsIntake),
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Net Carbs (g)',
            data: historyData.map(d => d.netCarbsIntake ?? d.carbsIntake),
            backgroundColor: 'rgba(167, 139, 250, 0.75)',
            borderColor: '#a78bfa',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Fiber (g)',
            data: historyData.map(d => d.fiberIntake || 0),
            backgroundColor: 'rgba(251, 191, 36, 0.75)',
            borderColor: '#fbbf24',
            borderWidth: 1.5,
            borderRadius: 6,
          }
        ]
  };

  // Weight Trend Line Dataset & Statistics
  const sortedWeight = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = sortedWeight.length > 0
    ? (isImperial ? sortedWeight[sortedWeight.length - 1].weightLbs : sortedWeight[sortedWeight.length - 1].weightKg)
    : 0;
  const firstWeight = sortedWeight.length > 0
    ? (isImperial ? sortedWeight[0].weightLbs : sortedWeight[0].weightKg)
    : 0;
  const weightChange = sortedWeight.length > 1
    ? Math.round((latestWeight - firstWeight) * 10) / 10
    : 0;
  const avgWeight = sortedWeight.length > 0
    ? Math.round(sortedWeight.reduce((s, w) => s + (isImperial ? w.weightLbs : w.weightKg), 0) / sortedWeight.length * 10) / 10
    : 0;
  const weightLabels = sortedWeight.map(w => {
    const dt = new Date(w.date + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  });

  const weightLineData = {
    labels: weightLabels.length > 0 ? weightLabels : labels,
    datasets: [
      {
        label: `Body Weight (${isImperial ? 'lbs' : 'kg'})`,
        data: sortedWeight.map(w => isImperial ? w.weightLbs : w.weightKg),
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        borderWidth: 3,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#ffffff',
        pointRadius: 5,
        tension: 0.3,
        fill: true
      }
    ]
  };

  // Blood Lipid Lab Trend Dataset & Statistics
  const sortedLipids = [...(lipidHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
  const latestLipid = sortedLipids.length > 0 ? sortedLipids[sortedLipids.length - 1] : null;
  const lipidLabels = sortedLipids.map(l => {
    const dt = new Date(l.date + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  });

  const lipidLineData = {
    labels: lipidLabels,
    datasets: [
      {
        label: 'Total (mg/dL)',
        data: sortedLipids.map(l => l.totalCholesterol),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointBackgroundColor: '#f59e0b',
        pointRadius: 4,
        tension: 0.2,
      },
      {
        label: 'LDL "Bad" (mg/dL)',
        data: sortedLipids.map(l => l.ldl),
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 2.5,
        pointBackgroundColor: '#f43f5e',
        pointRadius: 5,
        tension: 0.2,
      },
      {
        label: 'HDL "Good" (mg/dL)',
        data: sortedLipids.map(l => l.hdl),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointBackgroundColor: '#10b981',
        pointRadius: 5,
        tension: 0.2,
      },
      {
        label: 'Triglycerides (mg/dL)',
        data: sortedLipids.map(l => l.triglycerides),
        borderColor: '#0284c7',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointBackgroundColor: '#0284c7',
        pointRadius: 4,
        tension: 0.2,
      }
    ]
  };

  const isMidnight = typeof document !== 'undefined' && document.documentElement.classList.contains('theme-midnight');
  const isLightMode = typeof document !== 'undefined' && document.documentElement.classList.contains('theme-teal-breeze');

  // Custom Chart.js plugin to add breathing room between top legend and the chart plot area
  const legendMarginPlugin = {
    id: 'legendMargin',
    beforeInit(chart: any) {
      const fitValue = chart.legend?.fit;
      if (fitValue) {
        chart.legend.fit = function fit() {
          fitValue.bind(chart.legend)();
          return (this.height += 16);
        };
      }
    }
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 6,
        bottom: 2,
        left: 2,
        right: 4
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          color: isLightMode ? '#334155' : isMidnight ? '#94a3b8' : '#8e8e93',
          font: { size: 11, weight: '600' },
          boxWidth: 9,
          boxHeight: 9,
          padding: 18,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: isLightMode ? '#ffffff' : isMidnight ? '#0f172a' : '#1c1c1e',
        titleColor: isLightMode ? '#0f172a' : '#ffffff',
        bodyColor: isLightMode ? '#334155' : isMidnight ? '#cbd5e1' : '#d1d1d6',
        borderColor: isLightMode ? '#cbd5e1' : isMidnight ? '#334155' : '#38383a',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: isLightMode ? 'rgba(203, 213, 225, 0.4)' : isMidnight ? 'rgba(51, 65, 85, 0.3)' : 'rgba(56, 56, 58, 0.3)' },
        ticks: { color: isLightMode ? '#475569' : isMidnight ? '#94a3b8' : '#8e8e93', font: { size: 11 } }
      },
      y: {
        grid: { color: isLightMode ? 'rgba(203, 213, 225, 0.4)' : isMidnight ? 'rgba(51, 65, 85, 0.3)' : 'rgba(56, 56, 58, 0.3)' },
        ticks: { color: isLightMode ? '#475569' : isMidnight ? '#94a3b8' : '#8e8e93', font: { size: 11 } },
        beginAtZero: metric !== 'weight' && metric !== 'lipids',
        grace: '6%'
      }
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">Historical Trends & Charts</h2>
            <p className="text-xs text-slate-400 truncate">Calories, net carbs, weight, and blood lipids progression</p>
          </div>
        </div>

        {/* Metric Selector Buttons - Centered, balanced, and responsive */}
        <div className="w-full sm:w-auto flex items-center justify-center p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 shadow-inner">
          <button
            type="button"
            onClick={() => setMetric('calories')}
            className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[64px] sm:min-w-[76px] ${
              metric === 'calories'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            Calories
          </button>
          <button
            type="button"
            onClick={() => setMetric('carbs')}
            className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[64px] sm:min-w-[76px] ${
              metric === 'carbs'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            Net Carbs
          </button>
          <button
            type="button"
            onClick={() => setMetric('weight')}
            className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[64px] sm:min-w-[76px] ${
              metric === 'weight'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            Weight
          </button>
          <button
            type="button"
            onClick={() => setMetric('lipids')}
            className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-95 transition-all min-w-[64px] sm:min-w-[76px] ${
              metric === 'lipids'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
            }`}
          >
            Lipids
          </button>
        </div>
      </div>

      {/* 7-Day Averages Summary Bar */}
      {metric === 'calories' && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          {/* 1. Avg Consumed */}
          <div className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="sm:hidden">Avg In</span>
                <span className="hidden sm:inline">7-Day Avg Consumed</span>
              </span>
              {loggedDaysCount > 0 && loggedDaysCount < historyData.length && (
                <span className="text-[10px] text-slate-500 hidden sm:inline">{loggedDaysCount}/7d</span>
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-cyan-300">
                {avgConsumed > 0 ? avgConsumed.toLocaleString() : '—'}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">kcal/d</span>
            </div>
          </div>

          {/* 2. Avg Burned */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="sm:hidden">Avg Burn</span>
                <span className="hidden sm:inline">7-Day Avg Burned</span>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">TDEE</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-emerald-300">
                {avgBurned.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">kcal/d</span>
            </div>
          </div>

          {/* 3. Weekly Net Balance */}
          <div className={`bg-slate-950/70 border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between ${
            isDeficit
              ? 'border-emerald-500/30'
              : isSurplus
                ? 'border-amber-500/30'
                : 'border-slate-800'
          }`}>
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  isDeficit ? 'bg-emerald-400' : isSurplus ? 'bg-amber-400' : 'bg-slate-400'
                }`} />
                <span className="sm:hidden">{isDeficit ? 'Deficit' : isSurplus ? 'Surplus' : 'Balance'}</span>
                <span className="hidden sm:inline">Weekly Net Balance</span>
              </span>
              {estWeeklyWeight && (
                <span className={`text-[10px] font-semibold hidden md:inline ${
                  isDeficit ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {isDeficit ? `~${estWeeklyWeight} ${isImperial ? 'lbs' : 'kg'}/wk loss` : `~${estWeeklyWeight} ${isImperial ? 'lbs' : 'kg'}/wk gain`}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className={`text-base sm:text-xl font-bold ${
                isDeficit ? 'text-emerald-300' : isSurplus ? 'text-amber-300' : 'text-slate-300'
              }`}>
                {avgConsumed === 0
                  ? '—'
                  : isDeficit
                    ? `-${Math.abs(netDaily).toLocaleString()}`
                    : isSurplus
                      ? `+${netDaily.toLocaleString()}`
                      : '0'}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                {avgConsumed === 0 ? 'no logs' : isDeficit ? 'kcal/d def.' : isSurplus ? 'kcal/d surp.' : 'balanced'}
              </span>
            </div>
          </div>
        </div>
      )}

      {metric === 'carbs' && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          {/* Net Carbs */}
          <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span className="sm:hidden">Net Carbs</span>
                <span className="hidden sm:inline">7-Day Avg Net Carbs</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-purple-300">
                {avgNetCarbs}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">g / day</span>
            </div>
          </div>

          {/* Total Carbs */}
          <div className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="sm:hidden">Total Carbs</span>
                <span className="hidden sm:inline">7-Day Avg Total Carbs</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-cyan-300">
                {avgTotalCarbs}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">g / day</span>
            </div>
          </div>

          {/* Fiber */}
          <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="sm:hidden">Fiber</span>
                <span className="hidden sm:inline">7-Day Avg Fiber</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-amber-300">
                {avgFiber}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">g / day</span>
            </div>
          </div>
        </div>
      )}

      {metric === 'weight' && sortedWeight.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          {/* Latest */}
          <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="sm:hidden">Latest</span>
                <span className="hidden sm:inline">Latest Logged</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-indigo-300">
                {latestWeight}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{isImperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>

          {/* Change */}
          <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="sm:hidden">Change</span>
                <span className="hidden sm:inline">Period Change</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className={`text-base sm:text-xl font-bold ${
                weightChange < 0 ? 'text-emerald-400' : weightChange > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}>
                {weightChange > 0 ? `+${weightChange}` : weightChange < 0 ? `${weightChange}` : '0.0'}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{isImperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>

          {/* Average */}
          <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="sm:hidden">Average</span>
                <span className="hidden sm:inline">Period Average</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-indigo-300">
                {avgWeight}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{isImperial ? 'lbs' : 'kg'}</span>
            </div>
          </div>
        </div>
      )}

      {metric === 'lipids' && sortedLipids.length > 0 && latestLipid && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          {/* Latest LDL */}
          <div className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="sm:hidden">LDL</span>
                <span className="hidden sm:inline">Latest LDL ("Bad")</span>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">&lt;100 target</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-rose-300">
                {latestLipid.ldl}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">mg/dL</span>
            </div>
          </div>

          {/* Latest HDL */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="sm:hidden">HDL</span>
                <span className="hidden sm:inline">Latest HDL ("Good")</span>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">&gt;50 target</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-emerald-300">
                {latestLipid.hdl}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">mg/dL</span>
            </div>
          </div>

          {/* Latest Triglycerides */}
          <div className="bg-slate-950/70 border border-sky-500/30 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="sm:hidden">Trigs</span>
                <span className="hidden sm:inline">Triglycerides</span>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">&lt;150 target</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="text-base sm:text-xl font-bold text-sky-300">
                {latestLipid.triglycerides}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">mg/dL</span>
            </div>
          </div>
        </div>
      )}

      <div className="h-72 sm:h-80 w-full pt-2">
        {metric === 'lipids' ? (
          sortedLipids.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <Heart className="w-8 h-8 text-rose-500/50 mb-1" />
              <span>No lipid panel tests logged yet</span>
              <span className="text-[11px] text-slate-600">Log your blood test results above to track cholesterol trends!</span>
            </div>
          ) : (
            <Line data={lipidLineData} options={chartOptions} plugins={[legendMarginPlugin]} />
          )
        ) : metric === 'weight' ? (
          sortedWeight.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <Scale className="w-8 h-8 text-slate-600 mb-1" />
              <span>No weight logs yet</span>
              <span className="text-[11px] text-slate-600">Log your scale weight above to start seeing trends!</span>
            </div>
          ) : (
            <Line data={weightLineData} options={chartOptions} plugins={[legendMarginPlugin]} />
          )
        ) : (
          <Bar data={barChartData} options={chartOptions} plugins={[legendMarginPlugin]} />
        )}
      </div>
    </div>
  );
};
