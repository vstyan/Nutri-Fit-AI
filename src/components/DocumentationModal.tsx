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
  ChevronRight,
  Key
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
  initialSection = 'gemini-key'
}) => {
  const normalizeSection = (sec: string) => (sec === 'google-fit' ? 'fitness-tracker' : sec);
  const [activeSection, setActiveSection] = useState<string>(() => normalizeSection(initialSection));

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(normalizeSection(initialSection));
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
      id: 'gemini-key',
      title: 'Gemini API Key Setup',
      icon: Sparkles,
      badge: 'Essential & Free',
      badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Overview Hero */}
          <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900 to-indigo-950/30 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-sm sm:text-base">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
                <span>Why You Need a Gemini API Key</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% Free
              </span>
            </div>
            <p className="text-slate-200 leading-relaxed">
              NutriFit AI is powered by Google&apos;s multimodal <strong>Gemini 3.8 Flash</strong> model to perform real-time photo meal recognition, natural language voice workout estimation, and the behavioral AI Coach.
            </p>
            <p className="text-slate-300 leading-relaxed">
              Because NutriFit AI is designed as a <strong>private, client-side app with no monthly subscriptions or centralized server fees</strong>, each user connects directly to Google using their own free API key from Google AI Studio.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                <span className="font-bold text-white block">📸 Meal Photos</span>
                <span className="text-[11px] text-slate-400">Identifies dishes, portions, carbs, fiber, protein &amp; lipids from plate photos.</span>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                <span className="font-bold text-white block">🎙️ Voice Workouts</span>
                <span className="text-[11px] text-slate-400">Translates spoken or written exercise descriptions into accurate calories burned.</span>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                <span className="font-bold text-white block">🧠 AI Coach</span>
                <span className="text-[11px] text-slate-400">Analyzes chrono-nutrition eating windows, habit trends &amp; weekly trajectories.</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Step-by-Step: How to Obtain Your Free Key in 60 Seconds
              </h4>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              {/* Step 1 */}
              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-white">Open Google AI Studio</p>
                  <p className="text-slate-400 text-xs">
                    Navigate to Google&apos;s official developer portal for API keys:
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-semibold rounded-lg text-xs transition active:scale-95 shadow-sm"
                  >
                    <span>Open aistudio.google.com/app/apikey</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">Sign In with Your Google Account</p>
                  <p className="text-slate-400 text-xs">
                    Log in with any personal Google account (e.g., your regular Gmail address). No credit card, payment details, or paid subscription is needed.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">Click &quot;Create API Key&quot;</p>
                  <p className="text-slate-400 text-xs">
                    Tap the blue button labeled <strong>&quot;Create API key&quot;</strong>. If prompted, select <strong>&quot;Create key in new project&quot;</strong> (this provisions an automatic, free sandbox project instantly).
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  4
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">Copy Your Key</p>
                  <p className="text-slate-400 text-xs">
                    A pop-up modal will appear displaying your API key (a string of characters starting with <code>AIzaSy...</code>). Click the <strong>Copy</strong> icon.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  5
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">Paste into NutriFit AI Settings</p>
                  <p className="text-slate-400 text-xs">
                    In NutriFit AI, open <strong>Settings</strong> (tap the ⚙️ gear icon in the top header), scroll down to <strong>&quot;Google Gemini API Key&quot;</strong>, paste your copied key, and tap <strong>&quot;Save Settings&quot;</strong>. That&apos;s it!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy & Free Quota Notice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                100% Private &amp; Secure
              </h5>
              <p className="text-[11px] text-slate-400">
                Your API key is saved exclusively in your browser&apos;s local IndexedDB or your private Google Drive backup. It is never transmitted to any third-party developer server.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <h5 className="font-bold text-white text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-cyan-400" />
                Generous Free Usage
              </h5>
              <p className="text-[11px] text-slate-400">
                Google provides up to 15 requests per minute and 1,500 free requests per day on AI Studio — plenty for multiple meals, workouts, and coach updates daily.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'fitness-tracker',
      title: 'Health Connect & Wearables',
      icon: Activity,
      badge: 'Zero Cloud Delay',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      content: (
        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <Lightbulb className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Instant On-Device Sync (No Cloud Lag)</span>
            </div>
            <p className="text-slate-300">
              NutriFit queries the <strong>Android Health Connect on-device repository</strong> directly on your phone instead of querying delayed cloud servers.
            </p>
            <p className="text-slate-300">
              Whether you use <strong>Google Fit, Samsung Health, Pixel Watch, Galaxy Watch, Garmin, Withings, or Wear OS</strong>, your companion apps write continuous sensor data directly to Health Connect.
            </p>
            <div className="bg-slate-900/90 border border-emerald-500/20 rounded-xl p-3 space-y-1.5 font-medium text-emerald-200">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Ensure your smartwatch or fitness band has synced to its companion app (e.g. Google Fit, Samsung Health, or Garmin Connect).</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Open NutriFit AI or tap <strong>Sync Health Connect</strong>. Your updated active calories, basal burn, and workouts appear immediately!</span>
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
              <li><strong>Date Switching:</strong> Navigating to any past day will automatically sync that day&apos;s Health Connect activity and workouts.</li>
            </ul>
          </div>

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              NEAT Double-Counting Protection Explained
            </h4>
            <p>
              In <strong>Configuration 2 (Fitness Tracker)</strong>, Health Connect continuously captures all movement sensors (steps, baseline pacing, walking, and everyday movement), which directly measures your <em>Non-Exercise Activity Thermogenesis (NEAT)</em>.
            </p>
            <p>
              To guarantee scientific accuracy, NutriFit AI detects your active Health Connect tracker connection and <strong>automatically zeros out the static manual NEAT baseline allowance</strong>. This ensures your daily steps and movement are never counted twice (once by wearable sensors and once by an estimated static multiplier).
            </p>
            <p>
              The engine then dynamically calculates and layers the <strong>Thermic Effect of Food (TEF)</strong> from each meal you log directly onto your tracked burn, producing a comprehensive, 100% accurate Total Daily Energy Expenditure (TDEE).
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

          <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-400" />
              What Does &quot;Energy %&quot; Mean?
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              In nutritional science and metabolic tracking, <strong>Energy %</strong> represents the proportion of your total daily calories that comes from a specific macronutrient, based on the established <strong>Atwater energy factors</strong>:
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-medium">
              <div className="bg-slate-950/80 border border-rose-500/30 rounded-lg p-2.5">
                <span className="text-rose-300 font-bold block text-xs">Protein</span>
                <span className="text-[11px] text-slate-400 font-mono">4 kcal / g</span>
              </div>
              <div className="bg-slate-950/80 border border-purple-500/30 rounded-lg p-2.5">
                <span className="text-purple-300 font-bold block text-xs">Carbohydrates</span>
                <span className="text-[11px] text-slate-400 font-mono">4 kcal / g</span>
              </div>
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-lg p-2.5">
                <span className="text-amber-300 font-bold block text-xs">Fats</span>
                <span className="text-[11px] text-slate-400 font-mono">9 kcal / g</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 pt-1 leading-relaxed">
              <strong>Formula:</strong> <code>Energy % = (Daily Grams × 4 kcal/g) ÷ Total Daily Calories × 100%</code>.
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <em>Example:</em> If you consume <strong>140g of protein</strong> on a <strong>2,240 kcal diet</strong>: 140g × 4 kcal/g = 560 kcal from protein, which equals <strong>25% Energy %</strong>. This metric tells you how protein-dense your nutrition is, remaining consistent even if your total intake fluctuates from day to day.
            </p>
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
