import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Settings, 
  Cloud, 
  HardDrive
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

  const handlePrevDay = () => {
    onDateChange(addDaysToDateString(selectedDate, -1));
  };

  const handleNextDay = () => {
    onDateChange(addDaysToDateString(selectedDate, 1));
  };

  return (
    <header 
      className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-4 pb-3"
      style={{
        paddingTop: 'max(14px, calc(env(safe-area-inset-top, 0px) + 8px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))'
      }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
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
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
          <button
            onClick={handlePrevDay}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDateChange(todayStr)}
            className="px-2 sm:px-2.5 py-0.5 text-xs font-semibold text-slate-200 flex items-center space-x-1.5 hover:text-cyan-400 transition"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="whitespace-nowrap">{formatDisplayDate(selectedDate)}</span>
          </button>

          <button
            onClick={handleNextDay}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action Badges: Storage + Settings */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Storage Mode Badge */}
          <button
            onClick={onOpenStorageModal}
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
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
            className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl transition flex items-center justify-center shadow-sm"
            title="Settings & Profile"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
