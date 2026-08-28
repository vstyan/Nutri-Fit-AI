import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  X, 
  RotateCw, 
  Sparkles, 
  Loader2, 
  FileText,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { analyzeFoodImage } from '../services/geminiService';
import { GeminiAnalysisResult } from '../types';

interface CameraCaptureProps {
  isOpen: boolean;
  geminiApiKey: string;
  onAnalysisComplete: (photoUrl: string, result: GeminiAnalysisResult) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  geminiApiKey,
  onAnalysisComplete,
  onClose
}) => {
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize camera stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isOpen && !capturedImage) {
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
          console.log('Live WebRTC stream not active (will use native phone camera):', err);
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
  }, [isOpen, capturedImage, facingMode]);

  if (!isOpen) return null;

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
        console.warn('Frame capture failed, opening camera input:', e);
      }
    }
    // Fallback to opening phone's native camera
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
    // Reset input so same photo can be re-selected if desired
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!capturedImage) return;

    if (!geminiApiKey) {
      setErrorMessage('Please enter your Gemini API Key in Settings to analyze meal photos.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await analyzeFoodImage(capturedImage, geminiApiKey, userNotes);
      onAnalysisComplete(capturedImage, result);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMessage(err.message || 'Failed to analyze food photo. Please try again.');
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
              <Camera className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white">Log Food Photo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Image Display */}
        <div className="relative bg-black flex-1 min-h-[300px] max-h-[420px] flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured meal"
              className="w-full h-full object-contain max-h-[420px]"
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
                <p className="text-sm font-bold text-white">Ready to snap or upload</p>
                <p className="text-xs text-slate-400 mt-1">Take a new photo with your phone camera or select from your photo gallery</p>
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCaptureFrame}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition"
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

          {/* Camera switch button when stream is active */}
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

          {/* Hidden Native Camera Input (Forces Camera) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Hidden Gallery Input (Forces Photo Library / Album Picker) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border-t border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Controls & Action Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3.5 shrink-0">
          {/* Optional context notes */}
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={userNotes}
              onChange={e => setUserNotes(e.target.value)}
              placeholder="Optional notes (e.g. almond milk, no croutons)"
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
                  onClick={handleAnalyze}
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
                      <span>Analyze Food & Calories</span>
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
      </div>
    </div>
  );
};
