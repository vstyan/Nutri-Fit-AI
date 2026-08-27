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
  const currentDate = new Date(selectedDate + 'T00:00:00');
  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    onDateChange(next.toISOString().split('T')[0]);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-lg border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 font-black text-base">
            N
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">NutriFit<span className="text-cyan-400 font-normal"> AI</span></h1>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
          <button
            onClick={handlePrevDay}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onDateChange(todayStr)}
            className="px-2.5 py-0.5 text-xs font-semibold text-slate-200 flex items-center space-x-1.5 hover:text-cyan-400 transition"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>{formatDateDisplay(selectedDate)}</span>
          </button>

          <button
            onClick={handleNextDay}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action Badges */}
        <div className="flex items-center space-x-2">
          {/* Storage Mode Badge */}
          <button
            onClick={onOpenStorageModal}
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              settings.storageLocation === 'google_drive'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Storage Location"
          >
            {settings.storageLocation === 'google_drive' ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Drive</span>
              </>
            ) : (
              <>
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Local Device</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
