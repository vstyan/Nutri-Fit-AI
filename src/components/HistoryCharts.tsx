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
import { TrendingUp, Scale, Zap, Wheat } from 'lucide-react';
import { WeightRecord } from '../types';

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
  isImperial?: boolean;
}

export const HistoryCharts: React.FC<HistoryChartsProps> = ({
  historyData,
  weightHistory = [],
  isImperial = true
}) => {
  const [metric, setMetric] = useState<'calories' | 'carbs' | 'weight'>('calories');

  const labels = historyData.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

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

  // Weight Trend Line Dataset
  const sortedWeight = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
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

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { size: 11, weight: '500' },
          boxWidth: 10,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        beginAtZero: metric !== 'weight'
      }
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Historical Trends & Charts</h2>
            <p className="text-xs text-slate-400">Calories, Net Carbs & Body Weight Progression</p>
          </div>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center space-x-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 self-end sm:self-auto">
          <button
            onClick={() => setMetric('calories')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              metric === 'calories'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Calories
          </button>
          <button
            onClick={() => setMetric('carbs')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              metric === 'carbs'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Net Carbs
          </button>
          <button
            onClick={() => setMetric('weight')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              metric === 'weight'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weight
          </button>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        {metric === 'weight' ? (
          sortedWeight.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
              <Scale className="w-8 h-8 text-slate-600 mb-1" />
              <span>No weight logs yet</span>
              <span className="text-[11px] text-slate-600">Log your scale weight above to start seeing trends!</span>
            </div>
          ) : (
            <Line data={weightLineData} options={chartOptions} />
          )
        ) : (
          <Bar data={barChartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
};
