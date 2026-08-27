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
import { Bar } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

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
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }>;
}

export const HistoryCharts: React.FC<HistoryChartsProps> = ({
  historyData
}) => {
  const [metric, setMetric] = useState<'carbs' | 'calories'>('carbs');

  const labels = historyData.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  });

  const chartData = {
    labels,
    datasets: metric === 'carbs'
      ? [
          {
            label: 'Carbs Intake (g)',
            data: historyData.map(d => d.carbsIntake),
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Carbs Burned (g)',
            data: historyData.map(d => d.carbsBurned),
            backgroundColor: 'rgba(74, 222, 128, 0.75)',
            borderColor: '#4ade80',
            borderWidth: 1.5,
            borderRadius: 6,
          }
        ]
      : [
          {
            label: 'Calories In (kcal)',
            data: historyData.map(d => d.caloriesIntake),
            backgroundColor: 'rgba(251, 113, 133, 0.75)',
            borderColor: '#fb7185',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Calories Burned (kcal)',
            data: historyData.map(d => d.caloriesBurned),
            backgroundColor: 'rgba(74, 222, 128, 0.75)',
            borderColor: '#4ade80',
            borderWidth: 1.5,
            borderRadius: 6,
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
          font: { size: 12, weight: '500' },
          boxWidth: 12,
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
        beginAtZero: true
      }
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Weekly Intake vs. Burn</h2>
            <p className="text-xs text-slate-400">Comparing your nutrition against carbs burned</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setMetric('carbs')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                metric === 'carbs'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Carbs (g)
            </button>
            <button
              onClick={() => setMetric('calories')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                metric === 'calories'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Calories (kcal)
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};
