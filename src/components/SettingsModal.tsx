import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles, 
  Activity,
  Palette,
  BookOpen,
  Plus,
  ShieldAlert,
  FileText,
  Eye,
  EyeOff,
  Save,
  Clipboard,
  Sliders
} from 'lucide-react';
import { TERMS_VERSION } from '../constants/termsContent';
import { applyThemeToDOM } from '../utils/themeUtils';

const POPULAR_GOAL_PRESETS = [
  'Lose body fat & lean down',
  'Build muscle & strength',
  'Lower LDL cholesterol & heart health',
  'Improve endurance & stamina',
  'Body recomposition (tone & strength)',
  'Manage blood sugar & insulin sensitivity',
  'Optimize gut health & digestion',
  'Boost daily energy & vitality'
];
import { AppSettings, Gender, UnitSystem, ThemeMode, APP_VERSION } from '../types';
import { 
  calculateBMR, 
  calculateFormulaBMR,
  kgToLbs, 
  lbsToKg, 
  cmToFeetInches, 
  feetInchesToCm 
} from '../utils/bmrCalculator';
import { getEffectiveTrackingMode } from '../utils/calorieEngine';
import { getLocalDateString } from '../utils/dateUtils';
import { 
  importBackupJson, 
  clearAllAppData,
  persistStickyGeminiKey,
  clearStickyGeminiKey
} from '../services/storageService';
import { exportBackupFile } from '../services/backupExportService';
import { checkForRemoteUpdate, applyAndroidOTAUpdate, RemoteVersionInfo } from '../services/updaterService';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  isConnectingHealthConnect?: boolean;
  isNativeAndroid?: boolean;
  onSaveSettings: (settings: AppSettings, explicitKeyUpdate?: boolean) => void;
  onClose: () => void;
  onOpenDocumentation?: (section?: string) => void;
  onConnectHealthConnect?: () => void;
  onDisconnectHealthConnect?: () => void;
  onOpenHealthConnectSettings?: () => void;
  onOpenTerms?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  isConnectingHealthConnect = false,
  isNativeAndroid = false,
  onSaveSettings,
  onClose,
  onOpenDocumentation,
  onConnectHealthConnect,
  onDisconnectHealthConnect,
  onOpenHealthConnectSettings,
  onOpenTerms
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Imperial unit helper states
  const [weightLbs, setWeightLbs] = useState<number>(() => kgToLbs(settings.profile.weightKg || 75));
  const [heightFt, setHeightFt] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).feet);
  const [heightIn, setHeightIn] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).inches);

  // Backup and clear modal states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [clearSuccessMessage, setClearSuccessMessage] = useState(false);

  // App update checking states
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle');
  const [availableVersionInfo, setAvailableVersionInfo] = useState<RemoteVersionInfo | null>(null);

  // Goal customization state
  const [customGoalInput, setCustomGoalInput] = useState('');

  // Gemini API key helper states
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyFeedback, setApiKeyFeedback] = useState<string>('');

  // BMR calibration helper states
  const [isCalibratingBmr, setIsCalibratingBmr] = useState(false);

  // Sync formData ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setCustomGoalInput('');
      setWeightLbs(kgToLbs(settings.profile.weightKg || 75));
      const { feet, inches } = cmToFeetInches(settings.profile.heightCm || 175);
      setHeightFt(feet);
      setHeightIn(inches);
      setBackupStatus(null);
      setIsExporting(false);
      setIsImporting(false);
      setShowClearConfirm(false);
      setClearSuccessMessage(false);
      setUpdateStatus('idle');
      setAvailableVersionInfo(null);
      setIsCheckingUpdate(false);
      setShowApiKey(false);
      setApiKeyFeedback('');
      setIsCalibratingBmr(Boolean(settings.profile.customBmr));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus('checking');

    try {
      const remoteInfo = await checkForRemoteUpdate();
      if (remoteInfo) {
        setAvailableVersionInfo(remoteInfo);
        setUpdateStatus('available');
      } else {
        if (!isNativeAndroid && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.update().catch(() => {});
          if (registration.waiting) {
            setAvailableVersionInfo(null);
            setUpdateStatus('available');
            return;
          }
        }
        setUpdateStatus('latest');
      }
    } catch (err) {
      console.warn('Update check failed:', err);
      setUpdateStatus('error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdateNow = async () => {
    localStorage.removeItem('nutrifit_deferred_version');

    if (isNativeAndroid && availableVersionInfo?.version) {
      setIsCheckingUpdate(true);
      try {
        await applyAndroidOTAUpdate(availableVersionInfo.version, availableVersionInfo.checksum);
      } catch (e: any) {
        console.error('Failed to apply Android OTA update:', e);
        alert(e?.message || 'Failed to download update bundle. Please try again.');
        setIsCheckingUpdate(false);
      }
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.update().catch(() => {});
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      } catch (e) {
        console.warn('Service worker skip waiting error:', e);
      }
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const currentBMR = calculateBMR(formData.profile);
  const formulaBMR = calculateFormulaBMR(formData.profile);
  const activeTrackingMode = getEffectiveTrackingMode(formData);
  const isConfig1 = activeTrackingMode === 'standalone';
  const isConfig2 = activeTrackingMode === 'tracker';

  const handleSetCustomBmr = (val: number) => {
    setFormData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        customBmr: val > 0 ? val : undefined
      }
    }));
  };

  const handlePasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        const clean = text.trim();
        setFormData(prev => ({ ...prev, geminiApiKey: clean }));
        persistStickyGeminiKey(clean);
        setApiKeyFeedback('Key pasted & stored!');
        setTimeout(() => setApiKeyFeedback(''), 3000);
      } else {
        alert('Clipboard is empty or does not contain text.');
      }
    } catch {
      alert('Could not read clipboard automatically. Please press and hold the input box and tap "Paste".');
    }
  };

  const handleSaveApiKeyInstant = () => {
    const key = (formData.geminiApiKey || '').trim();
    if (key) {
      persistStickyGeminiKey(key);
      onSaveSettings({ ...formData, geminiApiKey: key }, true);
      setApiKeyFeedback('API Key saved & active!');
      setTimeout(() => setApiKeyFeedback(''), 3000);
    } else {
      clearStickyGeminiKey();
      onSaveSettings({ ...formData, geminiApiKey: '' }, true);
      setApiKeyFeedback('API Key cleared.');
      setTimeout(() => setApiKeyFeedback(''), 3000);
    }
  };

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

  const selectedPrimaryGoals = formData.goals.primaryGoals || [];

  const handleToggleGoal = (goalText: string) => {
    if (selectedPrimaryGoals.includes(goalText)) {
      setFormData(prev => ({
        ...prev,
        goals: {
          ...prev.goals,
          primaryGoals: (prev.goals.primaryGoals || []).filter(g => g !== goalText)
        }
      }));
    } else {
      if (selectedPrimaryGoals.length >= 5) return;
      setFormData(prev => ({
        ...prev,
        goals: {
          ...prev.goals,
          primaryGoals: [...(prev.goals.primaryGoals || []), goalText]
        }
      }));
    }
  };

  const handleAddCustomGoal = () => {
    const trimmed = customGoalInput.trim();
    if (!trimmed) return;
    if (selectedPrimaryGoals.length >= 5) return;
    if (selectedPrimaryGoals.includes(trimmed)) {
      setCustomGoalInput('');
      return;
    }
    setFormData(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        primaryGoals: [...(prev.goals.primaryGoals || []), trimmed]
      }
    }));
    setCustomGoalInput('');
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
    setIsExporting(true);
    setBackupStatus(null);
    try {
      const res = await exportBackupFile();
      if (!res.canceled) {
        setBackupStatus({
          type: 'success',
          message: res.message || 'Backup exported successfully!'
        });
      }
    } catch (err: any) {
      setBackupStatus({
        type: 'error',
        message: err?.message || 'Failed to export backup.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setBackupStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importBackupJson(text);
        setBackupStatus({
          type: 'success',
          message: res.message
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setBackupStatus({
          type: 'error',
          message: err.message || 'Failed to import backup file. Please ensure it is a valid NutriFit JSON backup.'
        });
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setBackupStatus({
        type: 'error',
        message: 'Failed to read the selected file.'
      });
      setIsImporting(false);
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

  const handleThemeChange = (mode: ThemeMode) => {
    setFormData(prev => ({ ...prev, themeMode: mode }));
    applyThemeToDOM(mode);
  };

  const handleModalClose = () => {
    // Revert live preview if closed without saving
    const activeTheme = settings.themeMode || 'pure_black';
    applyThemeToDOM(activeTheme);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({ ...formData, storagePromptDismissed: true }, true);
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
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight">App Settings &amp; Profile</h2>
            <p className="text-[11px] text-slate-400">Profile, BMR calibration, API keys &amp; sync</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSubmit}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition shadow flex items-center space-x-1.5 ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1">
          {/* User Guide & Documentation Shortcut */}
          {onOpenDocumentation && (
            <div className="bg-gradient-to-r from-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">NutriFit AI Guide &amp; Documentation</h4>
                  <p className="text-[11px] text-slate-400">Google Fit sync tips, TDEE model, AI logging &amp; offline mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenDocumentation()}
                className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 font-semibold text-xs rounded-xl border border-cyan-500/40 transition active:scale-95 shrink-0"
              >
                Open Guide
              </button>
            </div>
          )}

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

            {/* Calculated BMR Live Display & Calibration */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3.5 space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Your Natural Base Burn (BMR)</div>
                    <div className="text-[11px] text-slate-400">
                      {formData.profile.customBmr ? 'Custom / Calibrated Target' : 'Mifflin-St Jeor Scientific Baseline'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-amber-400">{currentBMR.toLocaleString()} <span className="text-xs font-normal text-slate-400">kcal/day</span></div>
                  <div className="text-[10px] text-slate-400">
                    Calories burned at complete rest
                  </div>
                </div>
              </div>

              {/* BMR Alignment / Calibration Controls */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300 font-medium">BMR Alignment / Calibration:</span>
                  <button
                    type="button"
                    onClick={() => setIsCalibratingBmr(prev => !prev)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>{isCalibratingBmr ? 'Hide Calibration' : formData.profile.customBmr ? 'Adjust Calibration' : 'Calibrate to Google Fit'}</span>
                  </button>
                </div>

                {isCalibratingBmr && (
                  <div className="mt-2.5 p-3 bg-slate-900 border border-slate-700/80 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                          Custom Daily BMR (kcal/day)
                        </label>
                        <input
                          type="number"
                          value={formData.profile.customBmr || ''}
                          placeholder={String(formulaBMR)}
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                            handleSetCustomBmr(val || 0);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold"
                        />
                      </div>
                      {formData.profile.customBmr && (
                        <button
                          type="button"
                          onClick={() => handleSetCustomBmr(0)}
                          className="self-end px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg border border-slate-700 transition"
                        >
                          Reset to Formula ({formulaBMR})
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      💡 <strong>Matching Google Fit:</strong> Google Fit calculates resting burn using your Google Account profile. If Google Fit reported e.g. 1,656 Cal at 9:30 PM with ~310 active calories, its daily resting BMR is ~<strong>1,505 kcal/day</strong>. Setting 1,505 here makes NutriFit match Google Fit&apos;s live total to the single calorie.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Daily Burn Tracking Mode (Configuration 1 vs Configuration 2) */}
          <div className="space-y-3 bg-slate-800/40 border border-slate-700/70 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                <span>Daily Burn Tracking Mode</span>
              </label>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isConfig2
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              }`}>
                {isConfig2 ? 'Configuration 2 Active' : 'Configuration 1 Active'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Choose how your total daily calories burned are tracked. Select either the app's standalone calculation or live synchronization from Google Fit / Health Connect.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* Configuration 1: No Fitness Tracker */}
              <div
                onClick={() => {
                  setFormData(prev => ({ ...prev, burnTrackingMode: 'standalone', includeRestingCalories: true }));
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                  isConfig1
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
                    : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isConfig1
                        ? 'border-amber-400 bg-amber-400'
                        : 'border-slate-600'
                    }`}>
                      {isConfig1 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      )}
                    </div>
                    <span className={`text-xs font-bold ${
                      isConfig1
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}>
                      Configuration 1 — No Fitness Tracker
                    </span>
                  </div>
                  {isConfig1 && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed pl-6.5">
                  Standalone calculation using your body profile. The app automatically computes your full 24-hour burn from base metabolism (BMR: {currentBMR.toLocaleString()} kcal) + baseline daily movement (NEAT) + food thermics (TEF) + any workouts logged in the app. No external tracker required.
                </p>

                {(settings.healthConnectConnected) && isConfig1 && (
                  <div className="mt-2.5 ml-6.5 p-2 bg-amber-950/40 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-center justify-between">
                    <span>Tracker is connected, but Standalone mode is selected. Tracker data will not be added to your daily burn.</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, burnTrackingMode: 'tracker' }));
                      }}
                      className="text-amber-200 underline font-semibold ml-2 hover:text-white"
                    >
                      Switch to Tracker
                    </button>
                  </div>
                )}
              </div>

              {/* Configuration 2: Fitness Tracker (Health Connect) */}
              <div
                onClick={() => {
                  setFormData(prev => ({ ...prev, burnTrackingMode: 'tracker' }));
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition space-y-3 ${
                  isConfig2
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/50'
                    : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isConfig2
                        ? 'border-cyan-400 bg-cyan-400'
                        : 'border-slate-600'
                    }`}>
                      {isConfig2 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      )}
                    </div>
                    <span className={`text-xs font-bold ${
                      isConfig2
                        ? 'text-cyan-400'
                        : 'text-slate-300'
                    }`}>
                      Configuration 2 — Fitness Tracker (Health Connect)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isConfig2 && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Active
                      </span>
                    )}
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                      settings.healthConnectConnected
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {settings.healthConnectConnected
                        ? '✓ Health Connect'
                        : 'Not Connected'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed pl-6.5">
                  Syncs burned calories, steps, and workouts directly on-device from Health Connect (compatible with Google Fit, Samsung Health, Pixel Watch, Galaxy Watch, Garmin, Withings, and Wear OS). Fast, private, and local with zero cloud delays.
                </p>

                {/* Android Native Health Connect Controls */}
                {isNativeAndroid && (
                  <div className="pl-6.5 space-y-2.5">
                    {settings.healthConnectConnected ? (
                      <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                        <div>
                          <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Health Connect Active</span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {settings.healthConnectLastSync
                              ? `Last synced: ${new Date(settings.healthConnectLastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Auto-syncs on app open'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {onOpenHealthConnectSettings && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenHealthConnectSettings();
                              }}
                              className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
                            >
                              App Permissions
                            </button>
                          )}
                          {onDisconnectHealthConnect && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDisconnectHealthConnect();
                                setFormData(prev => ({ ...prev, burnTrackingMode: 'standalone', includeRestingCalories: true }));
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-950/30 transition font-medium"
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {onConnectHealthConnect && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConnectHealthConnect();
                            }}
                            disabled={isConnectingHealthConnect}
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-900/20 disabled:opacity-50"
                          >
                            <Activity className="w-4 h-4" />
                            <span>{isConnectingHealthConnect ? 'Requesting Permissions...' : 'Connect Health Connect'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Non-Android Information */}
                {!isNativeAndroid && (
                  <div className="pl-6.5">
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                      <p>Health Connect auto-sync is powered by Android on-device sensors. Install the NutriFit AI Android app to automatically sync with Google Fit, Pixel Watch, Galaxy Watch, or Samsung Health.</p>
                    </div>
                  </div>
                )}

                {onOpenDocumentation && (
                  <div className="pl-6.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDocumentation('fitness-tracker');
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-semibold transition"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>How fitness tracker sync works &amp; tips &rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Daily Goals */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              <span>Daily Target Goals</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
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
              <div>
                <span className="text-[10px] text-violet-400 font-semibold block mb-1">Chol (mg)</span>
                <input
                  type="number"
                  value={formData.goals.dailyCholesterolTarget === 0 ? '' : (formData.goals.dailyCholesterolTarget || 300)}
                  placeholder="300"
                  onFocus={e => e.target.select()}
                  onChange={e => handleGoalChange('dailyCholesterolTarget', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
            </div>

            {/* 3b. Primary Diet & Exercise Goals (Top 5) */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Primary Diet &amp; Exercise Goals (Top 5)</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  selectedPrimaryGoals.length === 5
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                    : selectedPrimaryGoals.length > 0
                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedPrimaryGoals.length}/5 Selected
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Choose or enter up to 5 primary goals so NutriFit AI Coach can factor your exact mission (e.g. fat loss, muscle gain, cholesterol, endurance) into every metabolic diagnosis, nutrient timing, and food recommendation.
              </p>

              {/* Selected Goals Badges */}
              {selectedPrimaryGoals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {selectedPrimaryGoals.map((goal, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 shadow-sm"
                    >
                      <span>🎯 {goal}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleGoal(goal)}
                        className="text-indigo-400 hover:text-white p-0.5 rounded hover:bg-indigo-800/40 transition"
                        title="Remove goal"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Popular Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_GOAL_PRESETS.map((preset, idx) => {
                    const isSelected = selectedPrimaryGoals.includes(preset);
                    const isMaxReached = selectedPrimaryGoals.length >= 5 && !isSelected;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleGoal(preset)}
                        disabled={isMaxReached}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-cyan-600/30 border-cyan-500/60 text-cyan-200 shadow-sm'
                            : isMaxReached
                              ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
                              : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600 active:scale-95'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-cyan-300" />}
                        <span>{preset}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Write-in Goal Input */}
              <div className="pt-1.5 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={customGoalInput}
                    onChange={e => setCustomGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomGoal();
                      }
                    }}
                    disabled={selectedPrimaryGoals.length >= 5}
                    placeholder={
                      selectedPrimaryGoals.length >= 5
                        ? 'Maximum 5 goals selected (remove one to add another)'
                        : 'Or type custom goal (e.g. Marathon prep, Lower blood pressure)...'
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomGoal}
                  disabled={!customGoalInput.trim() || selectedPrimaryGoals.length >= 5}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Gemini API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Key className="w-4 h-4" />
                <span>Gemini API Key</span>
              </label>
              <div className="flex items-center gap-3">
                {onOpenDocumentation && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDocumentation('gemini-key');
                    }}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition"
                    title="Read the step-by-step API key setup guide"
                  >
                    <BookOpen className="w-3 h-3 text-cyan-400" />
                    <span>Setup Guide</span>
                  </button>
                )}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>Get API key for free</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.geminiApiKey}
                  onChange={e => {
                    const clean = e.target.value;
                    setFormData(prev => ({ ...prev, geminiApiKey: clean }));
                    if (clean.trim()) {
                      persistStickyGeminiKey(clean.trim());
                    }
                  }}
                  placeholder="Paste your Google AI Studio API key (AIza...)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-20 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                />
                <div className="absolute right-2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setShowApiKey(prev => !prev)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteApiKey}
                    className="p-1.5 text-cyan-400 hover:text-cyan-300 rounded-lg hover:bg-cyan-500/10 transition"
                    title="Paste from clipboard"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Buttons & Feedback */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePasteApiKey}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold rounded-lg border border-slate-700 flex items-center space-x-1 transition active:scale-95"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Paste Key</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveApiKeyInstant}
                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-[11px] font-semibold rounded-lg border border-cyan-500/40 flex items-center space-x-1 transition active:scale-95"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save Key</span>
                  </button>
                </div>

                {apiKeyFeedback ? (
                  <span className="text-[11px] text-emerald-400 font-semibold animate-in fade-in">
                    {apiKeyFeedback}
                  </span>
                ) : formData.geminiApiKey ? (
                  <span className="text-[10px] text-emerald-400/90 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Key active &amp; ready</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">No key saved yet</span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Used by Gemini AI to analyze meal photos and descriptions.</p>
          </div>

          {/* 5. Storage Destination */}
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

          {/* 6. Backup, Restore & Clear Data Management */}
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
                disabled={isExporting}
                className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl border border-slate-700 text-left transition flex items-center space-x-2.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">{isExporting ? 'Exporting...' : 'Export Backup'}</div>
                  <div className="text-[10px] text-slate-400">Save full JSON file</div>
                </div>
              </button>

              {/* Restore Backup */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl border border-slate-700 text-left transition flex items-center space-x-2.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">{isImporting ? 'Restoring...' : 'Restore Backup'}</div>
                  <div className="text-[10px] text-slate-400">Upload .json backup</div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,text/plain,*/*"
                className="hidden"
                onChange={handleImportFileSelected}
              />
            </div>

            {/* Backup Status Alert */}
            {backupStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                backupStatus.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
              }`}>
                {backupStatus.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{backupStatus.message}</span>
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

            {/* 7. Appearance & Theme (Pure Black OLED vs Teal Breeze vs Nordic Frost) */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  Appearance & Theme
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Dark & Light Modes</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pure Black option */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('pure_black')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    (formData.themeMode || 'pure_black') === 'pure_black'
                      ? 'bg-black/90 border-cyan-500 ring-1 ring-cyan-500/60 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="w-8 h-8 rounded-xl bg-black border border-slate-700 flex items-center justify-center shrink-0 shadow-inner">
                      <div className="w-3.5 h-3.5 rounded-lg bg-[#1C1C1E] border border-slate-600 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      </div>
                    </div>
                    {(formData.themeMode || 'pure_black') === 'pure_black' && (
                      <Check className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Pure Black</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-normal">Dark</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      OLED true black canvas with neutral gray cards. Maximum battery savings.
                    </p>
                  </div>
                </button>

                {/* Teal Breeze option */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('teal_breeze')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    formData.themeMode === 'teal_breeze'
                      ? 'bg-teal-500/10 border-teal-500 ring-1 ring-teal-500/60 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="w-8 h-8 rounded-xl bg-[#F0FDFA] border border-teal-300 flex items-center justify-center shrink-0 shadow-sm">
                      <div className="w-3.5 h-3.5 rounded-lg bg-white border border-teal-400 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      </div>
                    </div>
                    {formData.themeMode === 'teal_breeze' && (
                      <Check className="w-4 h-4 text-teal-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Teal Breeze</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-500/30 font-normal">Light</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Soft aqua mist canvas with white cards, frosted ice teal borders & vibrant accents.
                    </p>
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                You can toggle between Dark and Light modes at any time. Changes preview immediately.
              </p>
            </div>

            {/* Legal & Health Disclaimer */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Legal &amp; Health Disclaimer
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  v{TERMS_VERSION} Accepted
                </span>
              </label>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Terms of Service &amp; Health Disclaimer</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {settings.termsAcceptedDate 
                      ? `Agreed on ${new Date(settings.termsAcceptedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}. Binding agreement covering informational use, experimental AI output, and assumption of risk.`
                      : 'Binding agreement covering informational use, experimental AI output, and assumption of risk.'}
                  </div>
                </div>

                {onOpenTerms && (
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 shrink-0 self-stretch sm:self-auto justify-center cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Agreement</span>
                  </button>
                )}
              </div>
            </div>

            {/* App Updates & Version */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  App Updates & Version
                </span>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  v{APP_VERSION}
                </span>
              </label>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>NutriFit AI PWA</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Explicit Approval Mode: Updates never install automatically without your permission.
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
                  <span>You are running the latest version of NutriFit AI (v{APP_VERSION}).</span>
                </div>
              )}

              {updateStatus === 'available' && (
                <div className="p-3 rounded-xl text-xs flex flex-col gap-2.5 bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 animate-in fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
                        <span className="font-bold text-white">
                          Update Available: v{availableVersionInfo?.version || 'New Version'}
                        </span>
                      </div>
                      {availableVersionInfo?.notes && (
                        <p className="text-[11px] text-slate-300 pl-6 leading-relaxed">
                          {availableVersionInfo.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-cyan-500/20">
                    <button
                      type="button"
                      onClick={() => setUpdateStatus('idle')}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
                    >
                      Keep Current v{APP_VERSION}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyUpdateNow}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow shrink-0 active:scale-95 cursor-pointer"
                    >
                      Accept &amp; Install Update
                    </button>
                  </div>
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
            onClick={handleModalClose}
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
