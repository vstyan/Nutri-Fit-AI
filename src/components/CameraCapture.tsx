import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, 
  X, 
  RotateCw, 
  Sparkles, 
  Loader2, 
  FileText, 
  AlertCircle,
  Image as ImageIcon,
  PenTool,
  Mic,
  Lightbulb,
  Radio,
  Square
} from 'lucide-react';
import { analyzeFoodImage, analyzeFoodText } from '../services/geminiService';
import { GeminiAnalysisResult } from '../types';

declare const window: any;

interface CameraCaptureProps {
  isOpen: boolean;
  geminiApiKey: string;
  onAnalysisComplete: (photoUrl: string, result: GeminiAnalysisResult) => void;
  onClose: () => void;
}

const EXAMPLE_MEALS = [
  '2 scrambled eggs, 1 slice whole wheat toast with butter, black coffee',
  'Grilled chicken breast with 1 cup brown rice and steamed broccoli',
  'Greek salad with feta, olives, cucumber, and olive oil dressing',
  '1 bowl of oatmeal with blueberries, honey, and almond milk',
  'Protein shake with whey, banana, and peanut butter'
];

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  geminiApiKey,
  onAnalysisComplete,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'photo' | 'text' | 'voice'>('photo');
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [textDescription, setTextDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Voice recording states & refs
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const baselineTextRef = useRef<string>('');
  const textDescriptionRef = useRef<string>('');
  textDescriptionRef.current = textDescription;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize Web Speech API with non-duplicating discrete utterance looping
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Prevents Android Chrome accumulating duplicate results
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
        setTextDescription(combined);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setErrorMessage(`Microphone status: ${event.error}. You can also type your meal.`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          // Commit current transcribed sentence as baseline and resume listening for next sentence
          baselineTextRef.current = textDescriptionRef.current ? textDescriptionRef.current.trim() : '';
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
    }

    return () => {
      if (recognitionRef.current) {
        isListeningRef.current = false;
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Reset all state cleanly whenever camera modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setUserNotes('');
      setTextDescription('');
      setErrorMessage(null);
      isListeningRef.current = false;
      setIsListening(false);
      setIsAnalyzing(false);
      setActiveTab('photo');
      baselineTextRef.current = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    } else {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      setCapturedImage(null);
      setUserNotes('');
      setTextDescription('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Initialize camera stream when in photo tab
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isOpen && activeTab === 'photo' && !capturedImage) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        })
        .then(stream => {
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => {
              setStreamActive(true);
            }).catch(() => {
              setStreamActive(false);
            });
          }
        })
        .catch(err => {
          console.log('Live WebRTC stream not active (will use native camera fallback):', err);
          setStreamActive(false);
        });
      } else {
        setStreamActive(false);
      }
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, activeTab, capturedImage, facingMode]);

  if (!isOpen) return null;

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type your meal description.');
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current.stop();
      } catch {}
    } else {
      setErrorMessage(null);
      // Preserve existing text as initial baseline
      baselineTextRef.current = textDescription ? textDescription.trim() : '';
      isListeningRef.current = true;
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const resizeAndConvertImage = (dataUrl: string, maxDim = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    });
  };

  const handleCaptureFrame = async () => {
    if (streamActive && videoRef.current && videoRef.current.videoWidth > 0) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const rawDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const optimized = await resizeAndConvertImage(rawDataUrl);
          setCapturedImage(optimized);
          return;
        }
      } catch (e) {
        console.warn('Frame capture failed, triggering camera file input:', e);
      }
    }
    cameraInputRef.current?.click();
  };

  const handleOpenGallery = () => {
    galleryInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const optimized = await resizeAndConvertImage(event.target.result as string);
        setCapturedImage(optimized);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyzePhoto = async () => {
    if (!capturedImage) return;

    if (!geminiApiKey) {
      setErrorMessage('Please enter your Gemini API Key in Settings to analyze meals.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await analyzeFoodImage(capturedImage, geminiApiKey, userNotes);
      const img = capturedImage;
      setCapturedImage(null);
      setUserNotes('');
      setTextDescription('');
      onAnalysisComplete(img, result);
    } catch (err: any) {
      console.error('Photo analysis error:', err);
      setErrorMessage(err.message || 'Failed to analyze food photo. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeTextOrVoice = async () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    if (!textDescription.trim()) {
      setErrorMessage('Please enter or speak a description of the meal you ate.');
      return;
    }

    if (!geminiApiKey) {
      setErrorMessage('Please enter your Gemini API Key in Settings to analyze meals.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const textToAnalyze = textDescription.trim();
      const result = await analyzeFoodText(textToAnalyze, geminiApiKey);
      setTextDescription('');
      setUserNotes('');
      setCapturedImage(null);
      onAnalysisComplete('', result);
    } catch (err: any) {
      console.error('Text analysis error:', err);
      setErrorMessage(err.message || 'Failed to estimate meal nutrition. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Log Meal with AI</h2>
          </div>
          <button
            onClick={() => {
              if (isListening && recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
              }
              setCapturedImage(null);
              setUserNotes('');
              setTextDescription('');
              setErrorMessage(null);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Tabs: Photo, Voice, Describe */}
        <div className="p-2 bg-slate-950/80 border-b border-slate-800 flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { 
              if (isListening) toggleVoiceRecording();
              setActiveTab('photo'); 
              setErrorMessage(null); 
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'photo'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>

          <button
            type="button"
            onClick={() => { 
              setActiveTab('voice'); 
              setErrorMessage(null); 
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'voice'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Mic</span>
          </button>

          <button
            type="button"
            onClick={() => { 
              if (isListening) toggleVoiceRecording();
              setActiveTab('text'); 
              setErrorMessage(null); 
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'text'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Describe (Text)</span>
          </button>
        </div>

        {/* Tab 1: Photo Viewfinder / Upload */}
        {activeTab === 'photo' && (
          <>
            <div className="relative bg-black flex-1 min-h-[280px] max-h-[380px] flex items-center justify-center overflow-hidden">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured meal"
                  className="w-full h-full object-contain max-h-[380px]"
                />
              ) : streamActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 space-y-4 max-w-xs">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-cyan-400 border border-slate-700">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Camera ready</p>
                    <p className="text-xs text-slate-400 mt-1">Take a photo or pick from your phone gallery</p>
                  </div>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition shadow"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenGallery}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition border border-slate-700"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Gallery</span>
                    </button>
                  </div>
                </div>
              )}

              {streamActive && !capturedImage && (
                <div className="absolute top-3 right-3 flex space-x-2">
                  <button
                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition"
                    title="Switch Camera"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border-t border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 shrink-0">
              <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={userNotes}
                  onChange={e => setUserNotes(e.target.value)}
                  placeholder="Optional notes (e.g. olive oil dressing, 2 eggs)"
                  className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-full"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                {capturedImage ? (
                  <>
                    <button
                      onClick={handleRetake}
                      disabled={isAnalyzing}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Retake</span>
                    </button>
                    <button
                      onClick={handleAnalyzePhoto}
                      disabled={isAnalyzing}
                      className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 disabled:opacity-60"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing with Gemini AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 fill-current" />
                          <span>Analyze Food & Macros</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenGallery}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 border border-slate-700"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Gallery</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCaptureFrame}
                      className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-cyan-600/20"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Voice-to-Meal Logging Mode */}
        {activeTab === 'voice' && (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  {isListening && (
                    <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition shadow-2xl ${
                      isListening
                        ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/40'
                        : 'bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white ring-4 ring-purple-500/30'
                    }`}
                  >
                    {isListening ? (
                      <Square className="w-8 h-8 fill-current" />
                    ) : (
                      <Mic className="w-9 h-9" />
                    )}
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">
                    {isListening ? 'Listening... (Tap red square when done)' : 'Tap Microphone to Speak'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isListening
                      ? 'Say ingredients and portions naturally'
                      : 'e.g. "I had a bowl of Greek yogurt with honey and blueberries"'}
                  </p>
                </div>
              </div>

              {/* Real-time Voice Transcript Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 min-h-[100px] flex flex-col justify-between">
                <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center justify-between">
                  <span>Speech Transcript:</span>
                  {textDescription && (
                    <button
                      type="button"
                      onClick={() => {
                        baselineTextRef.current = '';
                        setTextDescription('');
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="text-sm font-medium text-white min-h-[50px]">
                  {textDescription ? (
                    textDescription
                  ) : (
                    <span className="text-slate-600 italic">Your spoken meal will appear here...</span>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnalyzeTextOrVoice}
                disabled={isAnalyzing || !textDescription.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-purple-500/20 flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI is analyzing voice meal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Estimate Nutrition from Voice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Text Description Mode */}
        {activeTab === 'text' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                Describe What You Ate
              </label>
              <textarea
                value={textDescription}
                onChange={e => {
                  setTextDescription(e.target.value);
                  baselineTextRef.current = e.target.value;
                }}
                placeholder="e.g. 2 slices of pepperoni pizza, 1 side garden salad with ranch dressing, and 1 can of diet coke..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition resize-none"
              />
              <p className="text-[11px] text-slate-400">
                Tip: Include portions or ingredients (e.g. "2 cups of rice", "grilled chicken", "with cheese") for higher accuracy.
              </p>
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-2">
              <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Example Ideas (Click to try):</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_MEALS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTextDescription(ex);
                      baselineTextRef.current = ex;
                    }}
                    className="text-[11px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80 text-left transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnalyzeTextOrVoice}
                disabled={isAnalyzing || !textDescription.trim()}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI is estimating calories & macros...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Estimate Nutrition with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
