import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Calendar, 
  Activity, 
  TrendingDown, 
  TrendingUp, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle,
  Plus,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { BloodLipidRecord, LipidUnit } from '../types';
import { 
  mgDlToMmolL, 
  mmolLToMgDl, 
  formatLipidValue,
  getTotalCholesterolStatus, 
  getLdlStatus, 
  getHdlStatus, 
  getTriglyceridesStatus,
  getCholesterolRatio,
  getNonHdlCholesterol
} from '../utils/lipidCalculator';
import { getLocalDateString } from '../utils/dateUtils';

interface LipidTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lipidHistory: BloodLipidRecord[];
  onSaveRecord: (record: BloodLipidRecord) => void;
  onDeleteRecord: (id: string) => void;
  userGender?: 'male' | 'female';
  initialTab?: 'log' | 'history';
}

export const LipidTrackerModal: React.FC<LipidTrackerModalProps> = ({
  isOpen,
  onClose,
  lipidHistory,
  onSaveRecord,
  onDeleteRecord,
  userGender = 'male',
  initialTab = 'log'
}) => {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>(initialTab);
  const [unit, setUnit] = useState<LipidUnit>('mg_dl');
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testDate, setTestDate] = useState<string>(getLocalDateString());
  const [totalInput, setTotalInput] = useState<string>('');
  const [ldlInput, setLdlInput] = useState<string>('');
  const [hdlInput, setHdlInput] = useState<string>('');
  const [triglyceridesInput, setTriglyceridesInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSaveSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Handle unit switch with dynamic input conversion
  const handleUnitToggle = (newUnit: LipidUnit) => {
    if (newUnit === unit) return;

    if (newUnit === 'mmol_l') {
      // mg/dL -> mmol/L
      if (totalInput) setTotalInput(mgDlToMmolL(parseFloat(totalInput), 'total').toFixed(2));
      if (ldlInput) setLdlInput(mgDlToMmolL(parseFloat(ldlInput), 'ldl').toFixed(2));
      if (hdlInput) setHdlInput(mgDlToMmolL(parseFloat(hdlInput), 'hdl').toFixed(2));
      if (triglyceridesInput) setTriglyceridesInput(mgDlToMmolL(parseFloat(triglyceridesInput), 'triglycerides').toFixed(2));
    } else {
      // mmol/L -> mg/dL
      if (totalInput) setTotalInput(String(mmolLToMgDl(parseFloat(totalInput), 'total')));
      if (ldlInput) setLdlInput(String(mmolLToMgDl(parseFloat(ldlInput), 'ldl')));
      if (hdlInput) setHdlInput(String(mmolLToMgDl(parseFloat(hdlInput), 'hdl')));
      if (triglyceridesInput) setTriglyceridesInput(String(mmolLToMgDl(parseFloat(triglyceridesInput), 'triglycerides')));
    }

    setUnit(newUnit);
  };

  // Convert raw inputs to canonical mg/dL for live status badges
  const totalMgDl = totalInput
    ? unit === 'mmol_l'
      ? mmolLToMgDl(parseFloat(totalInput), 'total')
      : parseFloat(totalInput)
    : 0;

  const ldlMgDl = ldlInput
    ? unit === 'mmol_l'
      ? mmolLToMgDl(parseFloat(ldlInput), 'ldl')
      : parseFloat(ldlInput)
    : 0;

  const hdlMgDl = hdlInput
    ? unit === 'mmol_l'
      ? mmolLToMgDl(parseFloat(hdlInput), 'hdl')
      : parseFloat(hdlInput)
    : 0;

  const triglyceridesMgDl = triglyceridesInput
    ? unit === 'mmol_l'
      ? mmolLToMgDl(parseFloat(triglyceridesInput), 'triglycerides')
      : parseFloat(triglyceridesInput)
    : 0;

  const totalStatus = getTotalCholesterolStatus(totalMgDl);
  const ldlStatus = getLdlStatus(ldlMgDl);
  const hdlStatus = getHdlStatus(hdlMgDl, userGender);
  const trigStatus = getTriglyceridesStatus(triglyceridesMgDl);
  const ratioResult = getCholesterolRatio(totalMgDl, hdlMgDl);
  const nonHdlResult = getNonHdlCholesterol(totalMgDl, hdlMgDl, unit);

  const resetForm = () => {
    setEditingId(null);
    setTestDate(getLocalDateString());
    setTotalInput('');
    setLdlInput('');
    setHdlInput('');
    setTriglyceridesInput('');
    setNotesInput('');
    setErrorMessage(null);
  };

  const handleEditRecord = (record: BloodLipidRecord) => {
    setEditingId(record.id);
    setTestDate(record.date);
    setUnit(record.unit || 'mg_dl');

    if (record.unit === 'mmol_l') {
      setTotalInput(mgDlToMmolL(record.totalCholesterol, 'total').toFixed(2));
      setLdlInput(mgDlToMmolL(record.ldl, 'ldl').toFixed(2));
      setHdlInput(mgDlToMmolL(record.hdl, 'hdl').toFixed(2));
      setTriglyceridesInput(mgDlToMmolL(record.triglycerides, 'triglycerides').toFixed(2));
    } else {
      setTotalInput(String(Math.round(record.totalCholesterol)));
      setLdlInput(String(Math.round(record.ldl)));
      setHdlInput(String(Math.round(record.hdl)));
      setTriglyceridesInput(String(Math.round(record.triglycerides)));
    }

    setNotesInput(record.notes || '');
    setActiveTab('log');
  };

  const handleSave = () => {
    if (!testDate) {
      setErrorMessage('Please select the date of your blood test.');
      return;
    }

    const tVal = parseFloat(totalInput);
    const lVal = parseFloat(ldlInput);
    const hVal = parseFloat(hdlInput);
    const tgVal = parseFloat(triglyceridesInput);

    if (isNaN(tVal) || tVal <= 0 || isNaN(lVal) || lVal <= 0 || isNaN(hVal) || hVal <= 0 || isNaN(tgVal) || tgVal <= 0) {
      setErrorMessage('Please enter valid positive numbers for all 4 lipid markers.');
      return;
    }

    // Convert values to canonical mg/dL for consistent storage
    const canonTotal = unit === 'mmol_l' ? mmolLToMgDl(tVal, 'total') : Math.round(tVal);
    const canonLdl = unit === 'mmol_l' ? mmolLToMgDl(lVal, 'ldl') : Math.round(lVal);
    const canonHdl = unit === 'mmol_l' ? mmolLToMgDl(hVal, 'hdl') : Math.round(hVal);
    const canonTrig = unit === 'mmol_l' ? mmolLToMgDl(tgVal, 'triglycerides') : Math.round(tgVal);

    const record: BloodLipidRecord = {
      id: editingId || `lipid-${Date.now()}`,
      date: testDate,
      timestamp: new Date().toISOString(),
      unit,
      totalCholesterol: canonTotal,
      ldl: canonLdl,
      hdl: canonHdl,
      triglycerides: canonTrig,
      notes: notesInput.trim() || undefined
    };

    onSaveRecord(record);
    setSaveSuccess(true);
    setErrorMessage(null);

    setTimeout(() => {
      setSaveSuccess(false);
      resetForm();
      setActiveTab('history');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Cardiovascular & Blood Lipid Lab
              </h2>
              <p className="text-xs text-slate-400">
                Track fasting cholesterol, LDL, HDL, and Triglycerides
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'log'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{editingId ? 'Edit Lab Test' : 'Log Lab Test'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'history'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Past Lab Tests ({lipidHistory.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'log' ? (
            <div className="space-y-4">
              {/* Unit & Date Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Date of Blood Test
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={testDate}
                      onChange={e => setTestDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Reporting Units
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-900 border border-slate-700 rounded-lg">
                    <button
                      type="button"
                      onClick={() => handleUnitToggle('mg_dl')}
                      className={`py-1 text-xs font-semibold rounded-md transition ${
                        unit === 'mg_dl'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      mg/dL (US)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitToggle('mmol_l')}
                      className={`py-1 text-xs font-semibold rounded-md transition ${
                        unit === 'mmol_l'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      mmol/L (Intl)
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Biomarkers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Cholesterol */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">Total Cholesterol</span>
                    {totalMgDl > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${totalStatus.badgeBg} ${totalStatus.color} ${totalStatus.badgeBorder}`}>
                        {totalStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={unit === 'mmol_l' ? '0.01' : '1'}
                      value={totalInput}
                      placeholder={unit === 'mmol_l' ? '4.80' : '185'}
                      onChange={e => setTotalInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Desirable: {unit === 'mmol_l' ? '< 5.17 mmol/L' : '< 200 mg/dL'}
                  </p>
                </div>

                {/* LDL Cholesterol */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">LDL ("Bad" Cholesterol)</span>
                    {ldlMgDl > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${ldlStatus.badgeBg} ${ldlStatus.color} ${ldlStatus.badgeBorder}`}>
                        {ldlStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={unit === 'mmol_l' ? '0.01' : '1'}
                      value={ldlInput}
                      placeholder={unit === 'mmol_l' ? '2.45' : '95'}
                      onChange={e => setLdlInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Optimal: {unit === 'mmol_l' ? '< 2.59 mmol/L' : '< 100 mg/dL'}
                  </p>
                </div>

                {/* HDL Cholesterol */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">HDL ("Good" Cholesterol)</span>
                    {hdlMgDl > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${hdlStatus.badgeBg} ${hdlStatus.color} ${hdlStatus.badgeBorder}`}>
                        {hdlStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={unit === 'mmol_l' ? '0.01' : '1'}
                      value={hdlInput}
                      placeholder={unit === 'mmol_l' ? '1.45' : '55'}
                      onChange={e => setHdlInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Higher is protective: {unit === 'mmol_l' ? '≥ 1.55 mmol/L' : '≥ 60 mg/dL'}
                  </p>
                </div>

                {/* Triglycerides */}
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">Triglycerides</span>
                    {triglyceridesMgDl > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${trigStatus.badgeBg} ${trigStatus.color} ${trigStatus.badgeBorder}`}>
                        {trigStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={unit === 'mmol_l' ? '0.01' : '1'}
                      value={triglyceridesInput}
                      placeholder={unit === 'mmol_l' ? '1.35' : '120'}
                      onChange={e => setTriglyceridesInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold"
                    />
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Normal: {unit === 'mmol_l' ? '< 1.70 mmol/L' : '< 150 mg/dL'}
                  </p>
                </div>
              </div>

              {/* Calculated Clinical Ratios Preview */}
              {(totalMgDl > 0 && hdlMgDl > 0) && (
                <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                    <span>Calculated Cardiovascular Risk Markers</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Total / HDL Ratio</div>
                      <div className="font-bold text-white flex items-center justify-between mt-0.5">
                        <span>{ratioResult.ratioStr}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${ratioResult.status.badgeBg} ${ratioResult.status.color} ${ratioResult.status.badgeBorder}`}>
                          {ratioResult.status.label}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400">Non-HDL Cholesterol</div>
                      <div className="font-bold text-white flex items-center justify-between mt-0.5">
                        <span>{nonHdlResult.formatted} {unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border ${nonHdlResult.status.badgeBg} ${nonHdlResult.status.color} ${nonHdlResult.status.badgeBorder}`}>
                          {nonHdlResult.status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Lab Notes / Clinical Context (Optional)
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  placeholder="e.g. Annual fasting checkup, 12-hour fast"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel Editing
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingId ? 'Update Lab Record' : 'Save Lab Record'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {lipidHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                  <div className="p-3 bg-rose-500/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-rose-400">
                    <Heart className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">No Blood Tests Recorded Yet</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Log your periodic fasting lipid panels to monitor your cardiovascular health and see how dietary changes impact your blood markers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('log')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition inline-flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Log First Lab Result</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Unit toggle for history viewing */}
                  <div className="flex justify-between items-center text-xs pb-1">
                    <span className="text-slate-400 font-medium">Viewing units:</span>
                    <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setUnit('mg_dl')}
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded ${
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
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded ${
                          unit === 'mmol_l'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        mmol/L
                      </button>
                    </div>
                  </div>

                  {lipidHistory.map((rec, idx) => {
                    const nextOlder = lipidHistory[idx + 1];
                    const ldlDiff = nextOlder ? Math.round(rec.ldl - nextOlder.ldl) : null;
                    const trigDiff = nextOlder ? Math.round(rec.triglycerides - nextOlder.triglycerides) : null;
                    const totStatus = getTotalCholesterolStatus(rec.totalCholesterol);
                    const lStatus = getLdlStatus(rec.ldl);
                    const hStatus = getHdlStatus(rec.hdl, userGender);
                    const tStatus = getTriglyceridesStatus(rec.triglycerides);
                    const ratio = getCholesterolRatio(rec.totalCholesterol, rec.hdl);

                    return (
                      <div
                        key={rec.id}
                        className="bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 space-y-2.5 transition shadow-md"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-rose-400" />
                            <span className="text-xs font-bold text-white">{rec.date}</span>
                            {idx === 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleEditRecord(rec)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition"
                              title="Edit record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete lab test from ${rec.date}?`)) {
                                  onDeleteRecord(rec.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 4 Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400 font-medium">Total Chol</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {formatLipidValue(rec.totalCholesterol, unit, 'total')}
                            </div>
                            <div className={`text-[9px] mt-1 font-semibold ${totStatus.color}`}>
                              {totStatus.label}
                            </div>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400 font-medium">LDL ("Bad")</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {formatLipidValue(rec.ldl, unit, 'ldl')}
                            </div>
                            <div className={`text-[9px] mt-1 font-semibold ${lStatus.color}`}>
                              {lStatus.label}
                            </div>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400 font-medium">HDL ("Good")</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {formatLipidValue(rec.hdl, unit, 'hdl')}
                            </div>
                            <div className={`text-[9px] mt-1 font-semibold ${hStatus.color}`}>
                              {hStatus.label}
                            </div>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                            <div className="text-[10px] text-slate-400 font-medium">Triglycerides</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {formatLipidValue(rec.triglycerides, unit, 'triglycerides')}
                            </div>
                            <div className={`text-[9px] mt-1 font-semibold ${trigStatus.color}`}>
                              {trigStatus.label}
                            </div>
                          </div>
                        </div>

                        {/* Ratios & Delta Trends */}
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 gap-2">
                          <div className="flex items-center gap-3">
                            <span>
                              Total/HDL: <strong className="text-white">{ratio.ratioStr}</strong> ({ratio.status.label})
                            </span>
                            {rec.notes && (
                              <span className="italic text-slate-500">
                                "{rec.notes}"
                              </span>
                            )}
                          </div>

                          {/* Delta against prior test */}
                          {ldlDiff !== null && (
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className={ldlDiff <= 0 ? 'text-emerald-400 font-medium flex items-center' : 'text-rose-400 font-medium flex items-center'}>
                                {ldlDiff <= 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5" />}
                                LDL {ldlDiff > 0 ? `+${ldlDiff}` : ldlDiff} mg/dL
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
