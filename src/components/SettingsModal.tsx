import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Key, 
  Cloud, 
  HardDrive, 
  Target, 
  Download, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  User,
  Flame,
  Scale
} from 'lucide-react';
import { AppSettings, Gender, UnitSystem, UserProfile } from '../types';
import { calculateBMR, kgToLbs, lbsToKg, cmToFeetInches, feetInchesToCm } from '../utils/bmrCalculator';
import { exportAllDataAsJson } from '../services/storageService';

declare const google: any;

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onSaveSettings,
  onClose
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  // Imperial display states
  const [weightLbs, setWeightLbs] = useState<number>(() => kgToLbs(settings.profile.weightKg || 75));
  const [heightFt, setHeightFt] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).feet);
  const [heightIn, setHeightIn] = useState<number>(() => cmToFeetInches(settings.profile.heightCm || 175).inches);

  // Sync internal state when settings are loaded or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      setWeightLbs(kgToLbs(settings.profile.weightKg || 75));
      const fi = cmToFeetInches(settings.profile.heightCm || 175);
      setHeightFt(fi.feet);
      setHeightIn(fi.inches);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const currentBMR = calculateBMR(formData.profile);

  const handleProfileChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value
      }
    }));
  };

  const handleWeightLbsChange = (lbs: number) => {
    setWeightLbs(lbs);
    handleProfileChange('weightKg', lbsToKg(lbs));
  };

  const handleHeightFtChange = (ft: number) => {
    setHeightFt(ft);
    handleProfileChange('heightCm', feetInchesToCm(ft, heightIn));
  };

  const handleHeightInChange = (inch: number) => {
    setHeightIn(inch);
    handleProfileChange('heightCm', feetInchesToCm(heightFt, inch));
  };

  const handleGoalChange = (field: keyof AppSettings['goals'], value: number) => {
    setFormData(prev => ({
      ...prev,
      goals: {
        ...prev.goals,
        [field]: value
      }
    }));
  };

  const handleGoogleLogin = () => {
    if (!formData.googleClientId) {
      setGoogleAuthError('Please enter your Google OAuth Client ID first.');
      return;
    }

    try {
      if (typeof google === 'undefined' || !google.accounts?.oauth2) {
        setGoogleAuthError('Google Identity Services SDK is still loading. Check your internet connection.');
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: formData.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            setGoogleAuthError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }
          if (tokenResponse.access_token) {
            setFormData(prev => ({
              ...prev,
              googleAccessToken: tokenResponse.access_token,
              storageLocation: 'google_drive'
            }));
            setGoogleAuthError(null);
          }
        }
      });

      client.requestAccessToken();
    } catch (e: any) {
      setGoogleAuthError(e.message || 'Failed to initialize Google OAuth client.');
    }
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
              Your age, weight, and height are used to calculate your natural <strong>Basal Metabolic Rate (BMR)</strong>—the base calories burned automatically every day at rest.
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
                  value={formData.profile.age}
                  onChange={e => handleProfileChange('age', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>

              {/* Weight */}
              {formData.profile.unitSystem === 'imperial' ? (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Weight (lbs)</label>
                  <input
                    type="number"
                    value={weightLbs}
                    onChange={e => handleWeightLbsChange(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.profile.weightKg}
                    onChange={e => handleProfileChange('weightKg', parseFloat(e.target.value) || 0)}
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
                      value={heightFt}
                      onChange={e => handleHeightFtChange(parseInt(e.target.value) || 0)}
                      placeholder="ft"
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white font-bold text-center"
                    />
                    <input
                      type="number"
                      value={heightIn}
                      onChange={e => handleHeightInChange(parseInt(e.target.value) || 0)}
                      placeholder="in"
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white font-bold text-center"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.profile.heightCm}
                    onChange={e => handleProfileChange('heightCm', parseInt(e.target.value) || 0)}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <span className="text-[10px] text-emerald-400 font-semibold block mb-1">Calories (kcal)</span>
                <input
                  type="number"
                  value={formData.goals.dailyCaloriesTarget}
                  onChange={e => handleGoalChange('dailyCaloriesTarget', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-sky-400 font-semibold block mb-1">Carbs (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyCarbsTarget}
                  onChange={e => handleGoalChange('dailyCarbsTarget', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-rose-400 font-semibold block mb-1">Protein (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyProteinTarget}
                  onChange={e => handleGoalChange('dailyProteinTarget', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
                />
              </div>
              <div>
                <span className="text-[10px] text-amber-400 font-semibold block mb-1">Fat (g)</span>
                <input
                  type="number"
                  value={formData.goals.dailyFatTarget}
                  onChange={e => handleGoalChange('dailyFatTarget', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-center"
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
                className={`p-3 rounded-xl border text-left transition ${
                  formData.storageLocation === 'local_indexeddb'
                    ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-xs text-white">Local Device</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">100% offline & private in browser IndexedDB</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, storageLocation: 'google_drive' }))}
                className={`p-3 rounded-xl border text-left transition ${
                  formData.storageLocation === 'google_drive'
                    ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500'
                    : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs text-white">Google Drive</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Dedicated folder in your personal Drive</p>
              </button>
            </div>
          </div>

          {/* Optional Google Drive OAuth config */}
          {formData.storageLocation === 'google_drive' && (
            <div className="space-y-3 bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Cloud className="w-4 h-4" />
                <span>Google Drive Connection</span>
              </label>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Google OAuth 2.0 Client ID (Optional)</label>
                <input
                  type="text"
                  value={formData.googleClientId || ''}
                  onChange={e => setFormData(prev => ({ ...prev, googleClientId: e.target.value }))}
                  placeholder="xxxxxx.apps.googleusercontent.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500"
                />
              </div>

              {googleAuthError && (
                <div className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{googleAuthError}</span>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 shadow"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{formData.googleAccessToken ? 'Re-authenticate' : 'Connect Google Drive'}</span>
                </button>

                {formData.googleAccessToken && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Drive Connected</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Backup & Export */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Offline JSON Backup</span>
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON Backup</span>
            </button>
          </div>
        </form>

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
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
