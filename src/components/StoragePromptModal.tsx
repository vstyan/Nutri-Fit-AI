import React, { useState, useEffect } from 'react';
import { Cloud, HardDrive, ShieldCheck, Check, ArrowRight, X } from 'lucide-react';
import { StorageLocation } from '../types';

interface StoragePromptModalProps {
  isOpen: boolean;
  currentLocation: StorageLocation;
  onSelect: (location: StorageLocation) => void;
  onClose: () => void;
}

export const StoragePromptModal: React.FC<StoragePromptModalProps> = ({
  isOpen,
  currentLocation,
  onSelect,
  onClose,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation>(currentLocation || 'local_indexeddb');

  useEffect(() => {
    if (isOpen) {
      setSelectedLocation(currentLocation || 'local_indexeddb');
    }
  }, [isOpen, currentLocation]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selectedLocation);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400 mb-1">
            <Cloud className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Where would you like to store your data?</h2>
          <p className="text-sm text-slate-300">
            Choose where your meal logs, nutritional summaries, and photos are saved. You can change this anytime in Settings.
          </p>
        </div>

        <div className="grid gap-3.5 pt-2">
          {/* Option 1: Google Drive */}
          <button
            type="button"
            onClick={() => setSelectedLocation('google_drive')}
            className={`flex items-start p-4 rounded-xl border text-left transition relative group cursor-pointer ${
              selectedLocation === 'google_drive'
                ? 'bg-cyan-950/40 border-cyan-500/80 ring-1 ring-cyan-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
            }`}
          >
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 mr-4 shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white text-base">Google Drive</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Cloud Synced
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Stores your daily data and photos in a private <code className="text-cyan-300 font-mono">Diet-Exercise-PWA/</code> folder in your personal Google Drive. Safe even if browser cache is cleared.
              </p>
            </div>
            {selectedLocation === 'google_drive' && (
              <div className="absolute right-4 top-4 text-cyan-400">
                <Check className="w-5 h-5" />
              </div>
            )}
          </button>

          {/* Option 2: Local Storage (IndexedDB) */}
          <button
            type="button"
            onClick={() => setSelectedLocation('local_indexeddb')}
            className={`flex items-start p-4 rounded-xl border text-left transition relative group cursor-pointer ${
              selectedLocation === 'local_indexeddb'
                ? 'bg-cyan-950/40 border-cyan-500/80 ring-1 ring-cyan-500'
                : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
            }`}
          >
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400 mr-4 shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-white text-base">Local Device (IndexedDB)</span>
                <span className="text-xs bg-slate-700 text-slate-300 font-medium px-2 py-0.5 rounded-full">
                  100% Offline
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Stores all logs directly on this device. Fast and private. You can manually export or import JSON backup files whenever you wish.
              </p>
            </div>
            {selectedLocation === 'local_indexeddb' && (
              <div className="absolute right-4 top-4 text-cyan-400">
                <Check className="w-5 h-5" />
              </div>
            )}
          </button>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>End-to-end user privacy</span>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold rounded-xl transition inline-flex items-center space-x-1.5 shadow-lg shadow-cyan-900/30 cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
