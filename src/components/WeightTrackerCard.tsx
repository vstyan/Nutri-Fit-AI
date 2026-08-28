import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Check, 
  TrendingDown, 
  TrendingUp, 
  Minus, 
  Plus, 
  History
} from 'lucide-react';
import { AppSettings, WeightRecord } from '../types';
import { kgToLbs, lbsToKg } from '../utils/bmrCalculator';

interface WeightTrackerCardProps {
  currentDate: string;
  weightRecord?: WeightRecord | null;
  settings: AppSettings;
  weightHistory: WeightRecord[];
  onSaveWeight: (weight: WeightRecord) => void;
}

export const WeightTrackerCard: React.FC<WeightTrackerCardProps> = ({
  currentDate,
  weightRecord,
  settings,
  weightHistory,
  onSaveWeight
}) => {
  const isImperial = settings.profile.unitSystem === 'imperial';
  const defaultDisplayWeight = isImperial
    ? (weightRecord ? weightRecord.weightLbs : kgToLbs(settings.profile.weightKg || 75))
    : (weightRecord ? weightRecord.weightKg : (settings.profile.weightKg || 75));

  const [inputWeight, setInputWeight] = useState<string>(String(defaultDisplayWeight));
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (weightRecord) {
      setInputWeight(String(isImperial ? weightRecord.weightLbs : weightRecord.weightKg));
    } else {
      const fallback = isImperial ? kgToLbs(settings.profile.weightKg || 75) : (settings.profile.weightKg || 75);
      setInputWeight(String(fallback));
    }
  }, [weightRecord, isImperial, settings.profile.weightKg, currentDate]);

  const handleNudge = (delta: number) => {
    const val = parseFloat(inputWeight) || defaultDisplayWeight;
    const nextVal = Math.round((val + delta) * 10) / 10;
    setInputWeight(String(nextVal));
  };

  const handleSave = () => {
    const num = parseFloat(inputWeight);
    if (!num || num <= 0) return;

    let kg = num;
    let lbs = num;

    if (isImperial) {
      lbs = num;
      kg = lbsToKg(num);
    } else {
      kg = num;
      lbs = kgToLbs(num);
    }

    const rec: WeightRecord = {
      date: currentDate,
      weightKg: kg,
      weightLbs: lbs,
      timestamp: new Date().toISOString()
    };

    onSaveWeight(rec);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  // Compute weight delta over recent days
  let deltaText = '';
  let isDown = false;
  if (weightHistory.length >= 2) {
    const sorted = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const diff = isImperial ? latest.weightLbs - first.weightLbs : latest.weightKg - first.weightKg;
    const rounded = Math.round(Math.abs(diff) * 10) / 10;
    if (rounded > 0) {
      isDown = diff < 0;
      deltaText = `${diff > 0 ? '+' : '-'}${rounded} ${isImperial ? 'lbs' : 'kg'} over ${sorted.length} entries`;
    }
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Daily Body Weight</h3>
            <p className="text-xs text-slate-400">Scale log & rolling trend tracker</p>
          </div>
        </div>

        {deltaText && (
          <div className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
            isDown 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
          }`}>
            {isDown ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
            <span>{deltaText}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={() => handleNudge(-0.2)}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          title="-0.2"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Input Field */}
        <div className="relative flex-1">
          <input
            type="number"
            step="0.1"
            value={inputWeight}
            onChange={e => setInputWeight(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg text-white font-black focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          <span className="absolute right-3 top-3 text-xs font-bold text-slate-500">
            {isImperial ? 'lbs' : 'kg'}
          </span>
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={() => handleNudge(0.2)}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          title="+0.2"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-lg ${
            isSaved 
              ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Logged!</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Log Weight</span>
            </>
          )}
        </button>
      </div>

      {weightRecord && (
        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
          <span>Logged today: <strong className="text-white">{isImperial ? weightRecord.weightLbs : weightRecord.weightKg} {isImperial ? 'lbs' : 'kg'}</strong></span>
          <span className="text-slate-500">Updated: {new Date(weightRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
};
