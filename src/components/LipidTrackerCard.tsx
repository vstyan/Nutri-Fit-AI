import React, { useState } from 'react';
import { 
  Heart, 
  Plus, 
  History, 
  TrendingDown, 
  TrendingUp, 
  Sparkles,
  AlertCircle,
  Activity
} from 'lucide-react';
import { BloodLipidRecord, LipidUnit } from '../types';
import { 
  formatLipidValue, 
  getTotalCholesterolStatus, 
  getLdlStatus, 
  getHdlStatus, 
  getTriglyceridesStatus,
  getCholesterolRatio,
  getNonHdlCholesterol
} from '../utils/lipidCalculator';

interface LipidTrackerCardProps {
  lipidHistory: BloodLipidRecord[];
  onOpenModal: (tab?: 'log' | 'history') => void;
  userGender?: 'male' | 'female';
}

export const LipidTrackerCard: React.FC<LipidTrackerCardProps> = ({
  lipidHistory,
  onOpenModal,
  userGender = 'male'
}) => {
  const [unit, setUnit] = useState<LipidUnit>('mg_dl');

  const latestRecord = lipidHistory.length > 0 ? lipidHistory[0] : null;
  const previousRecord = lipidHistory.length > 1 ? lipidHistory[1] : null;

  // Status for latest record
  const totalStatus = latestRecord ? getTotalCholesterolStatus(latestRecord.totalCholesterol) : null;
  const ldlStatus = latestRecord ? getLdlStatus(latestRecord.ldl) : null;
  const hdlStatus = latestRecord ? getHdlStatus(latestRecord.hdl, userGender) : null;
  const trigStatus = latestRecord ? getTriglyceridesStatus(latestRecord.triglycerides) : null;
  const ratio = latestRecord ? getCholesterolRatio(latestRecord.totalCholesterol, latestRecord.hdl) : null;
  const nonHdl = latestRecord ? getNonHdlCholesterol(latestRecord.totalCholesterol, latestRecord.hdl, unit) : null;

  // Delta vs previous test
  const ldlDiff = (latestRecord && previousRecord) 
    ? Math.round(latestRecord.ldl - previousRecord.ldl) 
    : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-lg flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-tight">
                  Lipid Panel & Heart Health
                </h3>
                {latestRecord && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Lab Log
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {latestRecord ? `Last tested: ${latestRecord.date}` : 'Cardiovascular blood biomarkers'}
              </p>
            </div>
          </div>

          {/* Unit Toggle */}
          {latestRecord && (
            <div className="flex gap-0.5 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setUnit('mg_dl')}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                  unit === 'mg_dl'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                mg/dL
              </button>
              <button
                type="button"
                onClick={() => setUnit('mmol_l')}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                  unit === 'mmol_l'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                mmol/L
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {!latestRecord ? (
          <div className="pt-3 pb-1 text-center space-y-2.5">
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Log your fasting blood test results (Total, LDL, HDL, Triglycerides) to monitor cardiovascular trends over time.
            </p>
            <button
              type="button"
              onClick={() => onOpenModal('log')}
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs rounded-xl shadow-lg transition active:scale-95 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log Lab Test</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {/* 4 Biomarkers Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {/* Total Cholesterol */}
              <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[10px] font-medium text-slate-400">Total</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {formatLipidValue(latestRecord.totalCholesterol, unit, 'total')}
                  <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                    {unit === 'mmol_l' ? 'mmol' : 'mg/dL'}
                  </span>
                </div>
                {totalStatus && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold inline-block mt-1 border ${totalStatus.badgeBg} ${totalStatus.color} ${totalStatus.badgeBorder}`}>
                    {totalStatus.label}
                  </span>
                )}
              </div>

              {/* LDL */}
              <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[10px] font-medium text-slate-400">LDL ("Bad")</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {formatLipidValue(latestRecord.ldl, unit, 'ldl')}
                  <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                    {unit === 'mmol_l' ? 'mmol' : 'mg/dL'}
                  </span>
                </div>
                {ldlStatus && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold inline-block mt-1 border ${ldlStatus.badgeBg} ${ldlStatus.color} ${ldlStatus.badgeBorder}`}>
                    {ldlStatus.label}
                  </span>
                )}
              </div>

              {/* HDL */}
              <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[10px] font-medium text-slate-400">HDL ("Good")</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {formatLipidValue(latestRecord.hdl, unit, 'hdl')}
                  <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                    {unit === 'mmol_l' ? 'mmol' : 'mg/dL'}
                  </span>
                </div>
                {hdlStatus && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold inline-block mt-1 border ${hdlStatus.badgeBg} ${hdlStatus.color} ${hdlStatus.badgeBorder}`}>
                    {hdlStatus.label}
                  </span>
                )}
              </div>

              {/* Triglycerides */}
              <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-[10px] font-medium text-slate-400">Triglycerides</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {formatLipidValue(latestRecord.triglycerides, unit, 'triglycerides')}
                  <span className="text-[9px] font-normal text-slate-400 ml-0.5">
                    {unit === 'mmol_l' ? 'mmol' : 'mg/dL'}
                  </span>
                </div>
                {trigStatus && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold inline-block mt-1 border ${trigStatus.badgeBg} ${trigStatus.color} ${trigStatus.badgeBorder}`}>
                    {trigStatus.label}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Info & Delta */}
            <div className="flex flex-wrap items-center justify-between text-xs pt-1 px-0.5 gap-2">
              <div className="flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
                {ratio && (
                  <span>
                    Total/HDL: <strong className="text-white">{ratio.ratioStr}</strong> ({ratio.status.label})
                  </span>
                )}
                {nonHdl && (
                  <span>
                    Non-HDL: <strong className="text-white">{nonHdl.formatted}</strong>
                  </span>
                )}
              </div>

              {ldlDiff !== null && (
                <div className="text-[10px]">
                  <span className={ldlDiff <= 0 ? 'text-emerald-400 font-medium flex items-center' : 'text-rose-400 font-medium flex items-center'}>
                    {ldlDiff <= 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5" />}
                    LDL {ldlDiff > 0 ? `+${ldlDiff}` : ldlDiff} mg/dL vs prior
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {latestRecord && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => onOpenModal('history')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({lipidHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('log')}
            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Log Test</span>
          </button>
        </div>
      )}
    </div>
  );
};
