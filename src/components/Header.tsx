import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Settings, 
  Cloud, 
  HardDrive,
  History,
  RotateCcw
} from 'lucide-react';
import { AppSettings } from '../types';
import { getLocalDateString, addDaysToDateString, formatDisplayDate } from '../utils/dateUtils';

interface HeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenStorageModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDate,
  onDateChange,
  settings,
  onOpenSettings,
  onOpenStorageModal,
}) => {
  const todayStr = getLocalDateString();
  const isToday = selectedDate === todayStr;
  const isPast = selectedDate < todayStr;

  const handlePrevDay = () => {
    onDateChange(addDaysToDateString(selectedDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDaysToDateString(selectedDate, 1));
  };

  return (
    <header 
      className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80"
    >
      <div 
        className="max-w-4xl mx-auto flex items-center justify-between gap-2 px-3 sm:px-4 pb-3"
        style={{
          paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 8px))',
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))'
        }}
      >
        {/* Logo & Brand */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 font-black text-sm">
            N
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              NutriFit<span className="text-cyan-400 font-normal"> AI</span>
            </h1>
          </div>
        </div>

        {/* Date Selector */}
        <div className={`flex items-center rounded-2xl p-0.5 sm:p-1 shadow-inner border transition-colors ${
          isToday 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-amber-950/40 border-amber-500/30'
        }`}>
          <button
            onClick={handlePrevDay}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 active:scale-90 transition"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => onDateChange(todayStr)}
            className={`h-10 sm:h-11 px-3 sm:px-3.5 text-xs sm:text-sm font-semibold flex items-center space-x-1.5 rounded-xl active:scale-95 transition ${
              isToday 
                ? 'text-slate-200 hover:text-cyan-400' 
                : 'text-amber-300 hover:text-amber-200'
            }`}
            title={isToday ? "Current Date (Today)" : "Viewing non-today date - Tap to return to Today"}
          >
            <Calendar className={`w-4 h-4 ${isToday ? 'text-cyan-400' : 'text-amber-400'}`} />
            <span className="whitespace-nowrap">{formatDisplayDate(selectedDate)}</span>
          </button>

          <button
            onClick={handleNextDay}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 active:scale-90 transition"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action Badges: Storage + Settings */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Storage Mode Badge */}
          <button
            onClick={onOpenStorageModal}
            className={`hidden sm:flex items-center space-x-1.5 px-3 h-10 sm:h-11 rounded-2xl text-xs font-medium border active:scale-95 transition ${
              settings.storageLocation === 'google_drive'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="Storage Location"
          >
            {settings.storageLocation === 'google_drive' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Drive</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Local</span>
              </>
            )}
          </button>

          {/* Settings Button - Large, Touch-Friendly */}
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-white border border-slate-700/80 rounded-2xl transition flex items-center justify-center shadow-sm"
            title="Settings & Profile"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Historical / Future Date Banner */}
      {!isToday && (
        <div className="bg-amber-950/50 border-t border-amber-500/20 px-3 sm:px-4 py-2 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 text-xs text-amber-300">
            <div className="flex items-center space-x-1.5 truncate mr-2">
              <History className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate text-xs">
                Viewing {isPast ? 'historical records' : 'future records'} for <strong className="font-semibold text-amber-200">{formatDisplayDate(selectedDate)}</strong>
              </span>
            </div>
            <button
              onClick={() => onDateChange(todayStr)}
              className="flex items-center space-x-1.5 min-h-[34px] px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 rounded-xl font-semibold transition text-xs shrink-0 border border-amber-500/30 shadow-sm"
              title="Return to Today"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              <span>Jump to Today</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
