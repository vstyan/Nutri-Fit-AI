import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ExternalLink, 
  Target, 
  ShieldCheck, 
  Check, 
  Cloud, 
  Database,
  User,
  Flame,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { AppSettings, Gender, UnitSystem } from '../types';
import { 
  calculateBMR, 
  kgToLbs, 
  lbsToKg, 
  cmToFeetInches, 
  feetInchesToCm 
} from '../utils/bmrCalculator';
import { 
  exportAllDataAsJson, 
  importBackupJson, 
  clearAllAppData 
} from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onSaveSettings,
  onClose
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Imperial unit helper states
  const [weightLbs, setWeightLbs] = useState<number>(() => kgToLbs(settings.profile.weightKg || 75));
  const [heightFt, setHeightFt] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).feet);
  const [heightIn, setHeightIn] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).inches);

  // Backup and clear modal states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [clearSuccessMessage, setClearSuccessMessage] = useState(false);

  // App update checking states
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle');

  // Sync formData whenever settings changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setWeightLbs(kgToLbs(settings.profile.weightKg || 75));
      const { feet, inches } = cmToFeetInches(settings.profile.heightCm || 175);
      setHeightFt(feet);
      setHeightIn(inches);
      setImportStatus(null);
      setShowClearConfirm(false);
      setClearSuccessMessage(false);
      setUpdateStatus('idle');
      setIsCheckingUpdate(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('checking');

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        setTimeout(() => {
          setIsCheckingUpdate(false);
          if (registration.waiting) {
            setUpdateStatus('available');
          } else {
            setUpdateStatus('latest');
          }
        }, 1000);
      } catch (err) {
        console.warn('Update check failed:', err);
        setIsCheckingUpdate(false);
        setUpdateStatus('error');
      }
    } else {
      setTimeout(() => {
        setIsCheckingUpdate(false);
        setUpdateStatus('latest');
      }, 800);
    }
  };

  const handleApplyUpdateNow = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const currentBMR = calculateBMR(formData.profile);

  const handleProfileChange = (field: keyof typeof formData.profile, value: any) => {
    setFormData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value
      }
    }));
  };

  const handleGoalChange = (field: keyof typeof formData.goals, value: number) => {
    setFormData(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        [field]: value
      }
    }));
  };

  // Imperial weight handler (converts lbs -> kg for storage)
  const handleWeightLbsChange = (lbs: number) => {
    setWeightLbs(lbs);
    handleProfileChange('weightKg', lbsToKg(lbs));
  };

  // Imperial height handler (converts ft+in -> cm for storage)
  const handleHeightFtChange = (ft: number) => {
    setHeightFt(ft);
    handleProfileChange('heightCm', feetInchesToCm(ft, heightIn));
  };

  const handleHeightInChange = (inch: number) => {
    setHeightIn(inch);
    handleProfileChange('heightCm', feetInchesToCm(heightFt, inch));
  };

  const handleExportBackup = async () => {
    const jsonStr = await exportAllDataAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrifit-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importBackupJson(text);
        setImportStatus({
          type: 'success',
          message: res.message
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setImportStatus({
          type: 'error',
          message: err.message || 'Failed to import backup file. Please ensure it is a valid NutriFit JSON backup.'
        });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteClearAll = async () => {
    await clearAllAppData(true); // Keep API key & profile settings
    setShowClearConfirm(false);
    setClearSuccessMessage(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <h2 className="text-lg font-bold text-white">App Settings & Profile</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1">
          {/* 1. User Profile & Base BMR Metabolism */}
          <div className="space-y-3 bg-slate-800/40 border border-slate-700/70 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Personal Profile & Natural Burn (BMR)</span>
              </label>

              {/* Unit System Switch */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => handleProfileChange('unitSystem', 'imperial')}
                  className={`px-2.5 py-0.5 rounded ${formData.profile.unitSystem === 'imperial' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                >
                  US (lbs/ft)
                </button>
                <button
                  type="button"
                  onClick={() => handleProfileChange('unitSystem', 'metric')}
                  className={`px-2.5 py-0.5 rounded ${formData.profile.unitSystem === 'metric' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                >
                  Metric (kg/cm)
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your age, weight, and height calculate your <strong>Basal Metabolic Rate (BMR)</strong>—the natural base calories burned automatically every day at rest.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Gender */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Gender</label>
                <select
                  value={formData.profile.gender}
                  onChange={e => handleProfileChange('gender', e.target.value as Gender)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Age */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Age (years)</label>
                <input
                  type="number"
                  value={formData.profile.age === 0 ? '' : formData.profile.age}
                  placeholder="30"
                  onFocus={e => e.target.select()}
                  onChange={e => handleProfileChange('age', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>

              {/* Weight */}
              {formData.profile.unitSystem === 'imperial' ? (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightLbs === 0 ? '' : weightLbs}
                    placeholder="165"
                    onFocus={e => e.target.select()}
                    onChange={e => handleWeightLbsChange(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.profile.weightKg === 0 ? '' : formData.profile.weightKg}
                    placeholder="75"
                    onFocus={e => e.target.select()}
                    onChange={e => handleProfileChange('weightKg', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                  />
                </div>
              )}

              {/* Height */}
              {formData.profile.unitSystem === 'imperial' ? (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Height (ft & in)</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={heightFt === 0 ? '' : heightFt}
                      placeholder="5"
                      onFocus={e => e.target.select()}
                      onChange={e => handleHeightFtChange(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white font-bold text-center"
                    />
                    <input
                      type="number"
                      value={heightIn === 0 ? '' : heightIn}
                      placeholder="9"
                      onFocus={e => e.target.select()}
                      onChange={e => handleHeightInChange(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white font-bold text-center"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.profile.heightCm === 0 ? '' : formData.profile.heightCm}
                    placeholder="175"
                    onFocus={e => e.target.select()}
                    onChange={e => handleProfileChange('heightCm', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                  />
                </div>
              )}
            </div>

            {/* Calculated BMR Live Display */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Your Natural Base Burn (BMR)</div>
                  <div className="text-[11px] text-slate-400">Mifflin-St Jeor Scientific Baseline</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-amber-400">{currentBMR.toLocaleString()} <span className="text-xs font-normal text-slate-400">kcal/day</span></div>
                <div className="text-[10px] text-slate-400">Burned before any exercise</div>
              </div>
            </div>
          </div>

          {/* 2. Daily Goals */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              <span>Daily Target Goals</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <span className="text-[10px] text-emerald-400 font-semibold block mb-1">Calories (kcal)</span>
                <input
                  type="number"
                  value={formData.goals.dailyCaloriesTarget === 0 ? '' : formData.goals.dailyCaloriesTarget}
                  placeholder="2000"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyCaloriesTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-sky-400 font-semibold block mb-1">Carbs (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyCarbsTarget === 0 ? '' : formData.goals.dailyCarbsTarget}
                  placeholder="200"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyCarbsTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-indigo-400 font-semibold block mb-1">Fiber (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyFiberTarget === 0 ? '' : (formData.goals.dailyFiberTarget || 30)}
                  placeholder="30"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyFiberTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-rose-400 font-semibold block mb-1">Protein (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyProteinTarget === 0 ? '' : formData.goals.dailyProteinTarget}
                  placeholder="140"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyProteinTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-semibold block mb-1">Fat (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyFatTarget === 0 ? '' : formData.goals.dailyFatTarget}
                  placeholder="65"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyFatTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
            </div>
          </div>

          {/* 3. Gemini API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                <span>Gemini API Key</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Get API key for free</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={formData.geminiApiKey}
              onChange={e => setFormData(prev => ({ ...prev, geminiApiKey: e.target.value }))}
              placeholder="Paste your Google AI Studio API key here"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <p className="text-[11px] text-slate-400">Used by Gemini AI to analyze meal photos and descriptions.</p>
          </div>

          {/* 4. Storage Destination */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Cloud className="w-4 h-4" />
              <span>Data Storage Destination</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, storageLocation: 'local_indexeddb' }))}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition ${
                  formData.storageLocation === 'local_indexeddb'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Database className={`w-5 h-5 ${formData.storageLocation === 'local_indexeddb' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {formData.storageLocation === 'local_indexeddb' && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Local Device</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Private on this phone/browser</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, storageLocation: 'google_drive' }))}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition ${
                  formData.storageLocation === 'google_drive'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Cloud className={`w-5 h-5 ${formData.storageLocation === 'google_drive' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  {formData.storageLocation === 'google_drive' && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Google Drive</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sync across all devices</div>
                </div>
              </button>
            </div>
          </div>

          {/* 5. Backup, Restore & Clear Data Management */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Data Backup & Management</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Export Backup */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-left transition flex items-center space-x-2.5"
              >
                <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Export Backup</div>
                  <div className="text-[10px] text-slate-400">Save full JSON file</div>
                </div>
              </button>

              {/* Import Restore */}
              <label className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-left transition flex items-center space-x-2.5 cursor-pointer">
                <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Restore Backup</div>
                  <div className="text-[10px] text-slate-400">Upload .json backup</div>
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFileSelected}
                />
              </label>
            </div>

            {/* Import Status Alert */}
            {importStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                importStatus.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
              }`}>
                {importStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{importStatus.message}</span>
              </div>
            )}

            {/* Clear All App Data Trigger */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2.5 px-3 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear & Reset All App Data...</span>
              </button>
            </div>

            {/* App Updates & Version */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  App Updates & Version
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  v1.1.0
                </span>
              </label>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>NutriFit AI PWA</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Offline-capable with 1-click update notifications
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={isCheckingUpdate}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 shrink-0 self-stretch sm:self-auto justify-center cursor-pointer"
                >
                  {isCheckingUpdate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Check for Updates</span>
                    </>
                  )}
                </button>
              </div>

              {updateStatus === 'latest' && (
                <div className="p-2.5 rounded-xl text-xs flex items-center space-x-2 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 animate-in fade-in">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>You are running the latest version of NutriFit AI.</span>
                </div>
              )}

              {updateStatus === 'available' && (
                <div className="p-3 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 animate-in fade-in">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span className="font-medium">A new version is available!</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUpdateNow}
                    className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition shadow shrink-0"
                  >
                    Refresh Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Clear Data Confirmation Modal Overlay */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center space-y-4 animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-base font-bold text-white">Reset All App Data?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                This will delete all logged meals, photos, weights, and daily exercise histories from your device storage.
              </p>
              <p className="text-[11px] text-amber-400/90 pt-1 font-medium">
                💡 Tip: You can download an Export Backup first so you never lose your history.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteClearAll}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                Yes, Reset Data
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow flex items-center space-x-1.5"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Settings</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
