import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  X, 
  Flame, 
  Activity, 
  Clock, 
  Check, 
  RotateCcw, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { UserProfile, WorkoutEntry, WorkoutEstimationResult } from '../types';
import { estimateWorkoutCalories } from '../services/geminiService';

interface VoiceWorkoutModalProps {
  isOpen: boolean;
  geminiApiKey: string;
  profile: UserProfile;
  includeResting: boolean;
  baseBmr: number;
  currentActiveKcal: number;
  onSaveWorkout: (workout: WorkoutEntry) => void;
  onClose: () => void;
}

export const VoiceWorkoutModal: React.FC<VoiceWorkoutModalProps> = ({
  isOpen,
  geminiApiKey,
  profile,
  includeResting,
  baseBmr,
  currentActiveKcal,
  onSaveWorkout,
  onClose
}) => {
  const [workoutText, setWorkoutText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimationResult, setEstimationResult] = useState<WorkoutEstimationResult | null>(null);
  const [confirmedKcal, setConfirmedKcal] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const workoutTextRef = useRef(workoutText);
  const baselineTextRef = useRef('');

  useEffect(() => {
    workoutTextRef.current = workoutText;
  }, [workoutText]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentUtterance = '';
        for (let i = 0; i < event.results.length; i++) {
          currentUtterance += event.results[i][0]?.transcript || '';
        }
        currentUtterance = currentUtterance.replace(/\s+/g, ' ').trim();
        const base = baselineTextRef.current ? baselineTextRef.current + ' ' : '';
        const combined = (base + currentUtterance).replace(/\s+/g, ' ').trim();
        setWorkoutText(combined);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setErrorMessage(`Microphone notice: ${event.error}. You can also type your workout description below.`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          baselineTextRef.current = workoutTextRef.current ? workoutTextRef.current.trim() : '';
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setWorkoutText('');
      setIsListening(false);
      isListeningRef.current = false;
      setEstimationResult(null);
      setConfirmedKcal('');
      setErrorMessage(null);
      baselineTextRef.current = '';
    } else {
      stopListening();
    }
  }, [isOpen]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setErrorMessage(null);
    baselineTextRef.current = workoutText.trim();
    isListeningRef.current = true;
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Estimate calories using Gemini
  const handleEstimateCalories = async () => {
    if (!workoutText.trim()) {
      setErrorMessage('Please provide a workout description first (speak or type).');
      return;
    }
    if (!geminiApiKey) {
      setErrorMessage('Gemini API key is required. Please add it in App Settings.');
      return;
    }

    stopListening();
    setIsEstimating(true);
    setErrorMessage(null);

    try {
      const result = await estimateWorkoutCalories(workoutText.trim(), profile, geminiApiKey);
      setEstimationResult(result);
      setConfirmedKcal(String(result.caloriesBurned));
    } catch (err: any) {
      console.error('Workout estimation failed:', err);
      setErrorMessage(err.message || 'Failed to estimate calories. Please check your API key and try again.');
    } finally {
      setIsEstimating(false);
    }
  };

  // Confirm and commit workout
  const handleConfirmWorkout = () => {
    if (!estimationResult) return;
    const finalCalories = Math.max(1, Math.round(Number(confirmedKcal) || estimationResult.caloriesBurned));

    const workoutEntry: WorkoutEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `workout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      title: estimationResult.title || 'Workout Session',
      description: workoutText.trim(),
      caloriesBurned: finalCalories,
      durationMinutes: estimationResult.durationMinutes,
      intensity: estimationResult.intensity,
      explanation: estimationResult.explanation
    };

    onSaveWorkout(workoutEntry);
    onClose();
  };

  if (!isOpen) return null;

  const quickSamples = [
    '30 min brisk walking in the park',
    '45 min weightlifting upper body',
    '35 min stationary cycling at moderate pace',
    '20 min HIIT interval training',
    '5 km jogging at 6:00 min/km pace'
  ];

  const parsedCalories = Math.max(0, Math.round(Number(confirmedKcal) || (estimationResult?.caloriesBurned || 0)));
  const newActiveTotal = currentActiveKcal + parsedCalories;
  const newTotalDailyBurn = includeResting ? (baseBmr + newActiveTotal) : newActiveTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Voice Workout Tracker</h2>
              <p className="text-xs text-slate-400">AI-powered calorie burn estimation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start space-x-2.5 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!estimationResult ? (
            /* STEP 1: Voice & Description Input */
            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                    <span>Describe your workout:</span>
                  </label>
                  {isListening && (
                    <span className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Listening...</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={workoutText}
                    onChange={e => setWorkoutText(e.target.value)}
                    placeholder={
                      isListening
                        ? "Listening... speak clearly (e.g. 'I ran 3 miles in 28 minutes', 'Did 40 minutes of weightlifting')..."
                        : "Tap the microphone to speak, or type your workout details here (exercise type, duration, intensity, distance)..."
                    }
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none"
                  />

                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      title={isListening ? "Stop listening" : "Start speaking"}
                      className={`absolute bottom-3 right-3 p-2.5 rounded-xl font-semibold transition flex items-center justify-center shadow-lg ${
                        isListening
                          ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Gemini uses your weight ({profile.weightKg || 70}kg), height ({profile.heightCm || 175}cm), and age ({profile.age || 30}y) to estimate calories.
                  </span>
                </p>
              </div>

              {/* Sample prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium block">Quick examples to try:</span>
                <div className="flex flex-wrap gap-1.5">
                  {quickSamples.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setWorkoutText(sample)}
                      className="text-[11px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 transition text-left"
                    >
                      "{sample}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimate Button */}
              <button
                type="button"
                onClick={handleEstimateCalories}
                disabled={isEstimating || !workoutText.trim()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition"
              >
                {isEstimating ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-white" />
                    <span>Calculating METs with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Estimate Calories Burnt</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* STEP 2: Review & Confirmation */
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Workout Card */}
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Detected Workout</span>
                    <h3 className="text-base font-extrabold text-white mt-0.5">{estimationResult.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {estimationResult.durationMinutes && (
                      <span className="text-[11px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {estimationResult.durationMinutes} min
                      </span>
                    )}
                    {estimationResult.intensity && (
                      <span className="text-[11px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-semibold px-2 py-0.5 rounded-md capitalize">
                        {estimationResult.intensity}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                  "{workoutText}"
                </div>

                {/* Calorie burn confirmation input */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Estimated Active Calories Burnt (Review or Adjust):
                  </label>
                  <div className="flex items-center justify-center space-x-2">
                    <input
                      type="number"
                      value={confirmedKcal}
                      onChange={e => setConfirmedKcal(e.target.value)}
                      onFocus={e => e.target.select()}
                      className="w-32 bg-slate-950 border border-emerald-500/50 rounded-xl text-center text-3xl font-black text-emerald-400 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="text-base font-bold text-slate-300">kcal</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    You can adjust this number before confirming if needed.
                  </span>
                </div>

                {/* Gemini scientific explanation */}
                {estimationResult.explanation && (
                  <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                    <span className="font-semibold text-slate-300">AI Calculation: </span>
                    {estimationResult.explanation}
                  </div>
                )}
              </div>

              {/* Running Total Preview */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Running Total Impact for Today</span>
                </div>

                <div className="space-y-1 text-slate-300">
                  {includeResting && (
                    <div className="flex justify-between text-slate-400">
                      <span>Base at-rest burn (BMR):</span>
                      <span className="font-semibold text-amber-400">{baseBmr} kcal</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Previous active exercise today:</span>
                    <span className="font-semibold text-slate-300">{currentActiveKcal} kcal</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>+ This workout:</span>
                    <span>+{parsedCalories} kcal</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
                    <span>New Daily Total Burned:</span>
                    <span className="text-emerald-300">{newTotalDailyBurn} kcal</span>
                  </div>
                </div>
              </div>

              {/* Confirmation Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEstimationResult(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition order-2 sm:order-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Edit Description</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmWorkout}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950 flex items-center justify-center space-x-1.5 transition order-1 sm:order-2"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm & Add to Today's Burn</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
