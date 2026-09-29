import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Activity, 
  Flame, 
  Camera, 
  Cloud, 
  WifiOff, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb, 
  HelpCircle,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { APP_VERSION } from '../types';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeColor: string;
  content: React.ReactNode;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'google-fit'
}) => {
  const [activeSection, setActiveSection] = useState<string>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections: DocSection[] = [
    {
      id: 'google-fit',
      title: 'Google Fit & Wearable Sync',
      icon: Activity,
      badge: 'Fitness Tracker',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <Lightbulb className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Pro Tip: Instant Syncing from Phone or Watch</span>
            </div>
            <p className="text-slate-300">
              NutriFit queries the <strong>Google Fit Cloud REST API</strong>, not your smartwatch or phone sensors directly over Bluetooth.
            </p>
            <p className="text-slate-300">
              Phones and smartwatches (Wear OS, Pixel Watch, Samsung Galaxy Watch) batch and upload sensor data periodically to conserve battery.
              If you just finished a workout or walk and want to see the latest calories right away:
            </p>
            <div className="bg-slate-900/90 border border-emerald-500/20 rounded-xl p-3 space-y-1.5 font-medium text-emerald-200">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Open the <strong>Google Fit app</strong> on your phone for a couple of seconds (this forces your phone to upload its latest steps to Google Cloud).</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Return to NutriFit AI and tap <strong>Sync Google Fit</strong>. Your updated burn will load immediately!</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              Automatic Background Syncing
            </h4>
            <p>
              You do not need to click the sync button every time! NutriFit AI syncs automatically on its own schedule:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs pl-1">
              <li><strong>App Focus / Unlock:</strong> Every time you switch back to NutriFit or unlock your phone, the app automatically syncs.</li>
              <li><strong>5-Minute Periodic Check:</strong> While you keep the app open, it automatically checks for new calorie data every 5 minutes.</li>
              <li><strong>Date Switching:</strong> Navigating to any past day will automatically sync that day&apos;s Google Fit history.</li>
            </ul>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              NEAT Double-Counting Protection Explained
            </h4>
            <p>
              In <strong>Configuration 2 (Google Fit Tracker)</strong>, Google Fit continuously captures all movement sensors (steps, baseline pacing, walking, and everyday movement), which directly measures your <em>Non-Exercise Activity Thermogenesis (NEAT)</em>.
            </p>
            <p>
              To guarantee scientific accuracy, NutriFit AI detects your active Google Fit tracker connection and <strong>automatically zeros out the static manual NEAT baseline allowance</strong>. This ensures your daily steps and movement are never counted twice (once by Google Fit sensors and once by an estimated static multiplier).
            </p>
            <p>
              The engine then dynamically calculates and layers the <strong>Thermic Effect of Food (TEF)</strong> from each meal you log directly onto your Google Fit burn, producing a comprehensive, 100% accurate Total Daily Energy Expenditure (TDEE).
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'tdee',
      title: 'TDEE & Calorie Burn Engine',
      icon: Flame,
      badge: 'Metabolism Model',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <p>
            NutriFit AI uses a science-based 4-pillar <strong>Total Daily Energy Expenditure (TDEE)</strong> model:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">1. Rest (BMR)</span>
              <p className="font-semibold text-white text-xs">Mifflin-St Jeor Equation</p>
              <p className="text-[11px] text-slate-400">
                The baseline calories your body burns at complete rest to keep organs functioning, calculated from your age, gender, height, and weight.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">2. NEAT (Daily Movement)</span>
              <p className="font-semibold text-white text-xs">Spontaneous Physical Activity</p>
              <p className="text-[11px] text-slate-400">
                Non-exercise movement like walking, standing, and chores. In manual mode, a 15% sedentary baseline floor is applied. With Google Fit, actual recorded steps are used instead.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-orange-500/30 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">3. TEF (Food Digestion)</span>
              <p className="font-semibold text-white text-xs">Dynamic Thermic Effect of Food</p>
              <p className="text-[11px] text-slate-400">
                The energy consumed processing the meals you log: <strong>25% of protein calories</strong>, <strong>8% of carb calories</strong>, and <strong>2% of fat calories</strong>.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">4. Exercise (EAT)</span>
              <p className="font-semibold text-white text-xs">Structured Workouts</p>
              <p className="text-[11px] text-slate-400">
                Logged gym sessions, running, cycling, or workouts estimated via Voice AI or pulled automatically from Google Fit.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Net Caloric Balance</span>
              <span className="text-[11px] text-slate-400">Net = Total Intake Calories − Total Burned (TDEE)</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-400 block">Deficit = Weight Loss</span>
              <span className="text-[10px] text-amber-400 font-semibold">Surplus = Weight Gain</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ai-logging',
      title: 'AI Meal & Voice Logging',
      icon: Camera,
      badge: 'Gemini AI',
      badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-400" />
              Photo Meal Analysis
            </h4>
            <p>
              Snap a clear photo of your meal or plate from above. Powered by Google Gemini 2.5 Flash with multimodal vision:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs pl-1">
              <li>Identifies individual dishes, sides, and ingredients.</li>
              <li>Estimates portion weights in grams and total calories.</li>
              <li>Calculates carbohydrates, dietary fiber, net carbs, protein, and detailed fat breakdown.</li>
              <li>Review and tweak weights or items anytime before saving.</li>
            </ul>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Good Fats vs. Saturated Fats Breakdown
            </h4>
            <p>
              NutriFit distinguishes between heart-healthy <strong>Unsaturated Fats</strong> (olive oil, avocados, nuts, fatty fish) and <strong>Saturated/Trans Fats</strong> with a dual-tone dashboard gauge to help you protect cardiovascular health while meeting fat goals.
            </p>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-400" />
              Voice Workout Logging
            </h4>
            <p>
              Tap the <strong>Voice Workout (AI)</strong> button and describe your session in natural language (e.g. <em>&quot;I ran 4 miles at an 8-minute pace&quot;</em> or <em>&quot;1 hour of intense bench and shoulder press&quot;</em>). Gemini estimates calories burned and logs the workout to your daily activity.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'storage',
      title: 'Cloud Backup & Data Storage',
      icon: Cloud,
      badge: 'Privacy & Backup',
      badgeColor: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Local Storage Mode (Default)
            </h4>
            <p>
              By default, all your nutrition records, workout logs, and weights are stored 100% locally in your device&apos;s private IndexedDB storage. No account is required and your personal data never leaves your device.
            </p>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-400" />
              Google Drive Cloud Sync
            </h4>
            <p>
              Connect your personal Google Drive in Settings to automatically sync your records to a dedicated <code>/NutriFit AI Backup</code> folder. Your data stays in your personal Google account.
            </p>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              JSON Export & Migration
            </h4>
            <p>
              In Settings, you can export a full <code>.json</code> backup at any time, or import data onto a new phone, tablet, or browser with one tap.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'offline',
      title: 'Offline Mode & PWA Installation',
      icon: WifiOff,
      badge: 'PWA Features',
      badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-sky-400" />
              Install as an App
            </h4>
            <p>
              NutriFit is a Progressive Web App (PWA). You can install it on your home screen for full-screen performance without app store downloads:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs pl-1">
              <li><strong>iOS (Safari):</strong> Tap the <em>Share</em> button in Safari &gt; tap <em>Add to Home Screen</em>.</li>
              <li><strong>Android (Chrome):</strong> Tap the three dots menu &gt; tap <em>Install App</em> or <em>Add to Home screen</em>.</li>
              <li><strong>Desktop (Chrome/Edge):</strong> Click the install icon in the address bar.</li>
            </ul>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-amber-400" />
              Full Offline Support
            </h4>
            <p>
              You can log meals, inspect historical charts, and track weight even on an airplane or with no cell service. When your connection returns, cloud backups and Google Fit automatically resume.
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentDoc = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 font-black">
              <BookOpen className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">NutriFit AI Guide</h2>
              <p className="text-[11px] text-slate-400">Documentation &amp; how the app works</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition active:scale-95"
            aria-label="Close documentation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="px-3 sm:px-4 py-2 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto flex space-x-1.5 scrollbar-none shrink-0">
          {sections.map(sec => {
            const Icon = sec.icon;
            const isSelected = sec.id === currentDoc.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <currentDoc.icon className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">{currentDoc.title}</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentDoc.badgeColor}`}>
              {currentDoc.badge}
            </span>
          </div>

          {currentDoc.content}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="hidden sm:inline">NutriFit AI &bull; Version {APP_VERSION}</span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold rounded-xl transition text-center"
          >
            Got it, close guide
          </button>
        </div>
      </div>
    </div>
  );
};
